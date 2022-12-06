import _ from "lodash";
import { fk_data as DataProto } from "fk-data-protocol/fk-data";
import { levenbergMarquardt } from "ml-levenberg-marquardt";

export type ModuleConfiguration = DataProto.ModuleConfiguration;

export function unixNow(): number {
  return Math.round(new Date().getTime() / 1000);
}

const debug = console;

export class CalibrationError extends Error {
  public readonly calibration = true;

  constructor(message: string) {
    super(message);
  }

  public static isInstance(error: CalibrationError): boolean {
    if (!error) return false;
    return error?.calibration === true;
  }
}

export abstract class CalibrationValue {}

export class PendingCalibrationPoint {
  constructor(
    public readonly index: number,
    public readonly references: number[],
    public readonly uncalibrated: number[],
    public readonly factory: number[]
  ) {}
}

export class PendingCalibration {
  constructor(public readonly points: PendingCalibrationPoint[] = []) {}

  public append(pcp: PendingCalibrationPoint): PendingCalibration {
    const newPoints = _.clone(this.points);
    newPoints[pcp.index] = pcp;
    return new PendingCalibration(newPoints);
  }
}

export abstract class CalibrationCurve {
  public calculate(pending: PendingCalibration): DataProto.Calibration {
    const points = pending.points.map(
      (p) =>
        new DataProto.CalibrationPoint({
          references: p.references,
          uncalibrated: p.uncalibrated,
          factory: p.factory,
        })
    );
    if (points.length == 0)
      throw new CalibrationError(`calibration failed: empty`);
    const coefficients = this.calculateCoefficients(pending);
    return DataProto.Calibration.create({
      type: this.curveType,
      time: unixNow(),
      points: points,
      coefficients: coefficients,
    });
  }

  public abstract get curveType(): DataProto.CurveType;

  public abstract calculateCoefficients(
    pending: PendingCalibration
  ): DataProto.CalibrationCoefficients;
}

function acceptableCoefficient(value: number): boolean {
  if (value === null || isNaN(value)) return false;
  return Math.abs(value) > 0.0001;
}

function acceptableOffset(value: number): boolean {
  if (value === null || isNaN(value)) return false;
  return true;
}

export class ExponentialCalibrationCurve extends CalibrationCurve {
  public get curveType(): DataProto.CurveType {
    return DataProto.CurveType.CURVE_EXPONENTIAL;
  }

  public calculateCoefficients(
    pending: PendingCalibration
  ): DataProto.CalibrationCoefficients {
    const x = pending.points.map((p) => p.uncalibrated[0]);
    const y = pending.points.map((p) => p.references[0]);

    function calibrationFunction([a, b, c]: [number, number, number]): (
      v: number
    ) => number {
      return (t) => a + b * Math.exp(t * c);
    }

    const data = {
      x: x,
      y: y,
    };

    // Pete 4/6/2022
    const options = {
      damping: 1.5,
      initialValues: _.clone([1000, 1500000, -7]),
      gradientDifference: 10e-2,
      maxIterations: 100,
      errorTolerance: 10e-3,
    };

    const fittedParams = levenbergMarquardt(data, calibrationFunction, options);

    const [a, b, c] = fittedParams.parameterValues;
    const coefficients = { a, b, c };

    debug.log(`cal:exponential ${JSON.stringify({ x, y, coefficients })}`);

    if (!acceptableOffset(coefficients.a))
      throw new CalibrationError(
        `calibration failed: ${JSON.stringify(coefficients)}`
      );
    if (!acceptableCoefficient(coefficients.b))
      throw new CalibrationError(
        `calibration failed: ${JSON.stringify(coefficients)}`
      );
    if (!acceptableCoefficient(coefficients.c))
      throw new CalibrationError(
        `calibration failed: ${JSON.stringify(coefficients)}`
      );
    return new DataProto.CalibrationCoefficients({
      values: [coefficients.a, coefficients.b, coefficients.c],
    });
  }
}

export class PowerCalibrationCurve extends CalibrationCurve {
  public get curveType(): DataProto.CurveType {
    return DataProto.CurveType.CURVE_POWER;
  }

  public calculateCoefficients(
    pending: PendingCalibration
  ): DataProto.CalibrationCoefficients {
    const len = pending.points.length;
    const x = pending.points.map((p) => p.uncalibrated[0]);
    const y = pending.points.map((p) => p.references[0]);

    const indices = _.range(0, len);
    const xSum = _.sum(x.map((x) => Math.log(x)));
    const xySum = _.sum(indices.map((i) => Math.log(x[i]) * Math.log(y[i])));
    const ySum = _.sum(y.map((y) => Math.log(y)));
    const xSquaredSum = _.sum(
      indices.map((i) => Math.log(x[i]) * Math.log(x[i]))
    );

    const b = (len * xySum - xSum * ySum) / (len * xSquaredSum - xSum ** 2);
    const a = Math.exp((ySum - b * xSum) / len);

    debug.log(
      `cal:power ${JSON.stringify({
        x,
        y,
        len,
        xSum,
        ySum,
        xySum,
        xSquaredSum,
      })}`
    );
    if (!acceptableCoefficient(a))
      throw new CalibrationError(`calibration failed: a=${a}`);
    if (!acceptableCoefficient(b))
      throw new CalibrationError(`calibration failed: b=${b}`);
    return new DataProto.CalibrationCoefficients({ values: [a, b] });
  }
}

export class LinearCalibrationCurve extends CalibrationCurve {
  public get curveType(): DataProto.CurveType {
    return DataProto.CurveType.CURVE_LINEAR;
  }

  public calculateCoefficients(
    pending: PendingCalibration
  ): DataProto.CalibrationCoefficients {
    const n = pending.points.length;
    const x = pending.points.map((p) => p.uncalibrated[0]);
    const y = pending.points.map((p) => p.references[0]);

    const indices = _.range(0, n);
    const xMean = _.mean(x);
    const yMean = _.mean(y);
    const numerParts = indices.map((i) => (x[i] - xMean) * (y[i] - yMean));
    const denomParts = indices.map((i) => (x[i] - xMean) ** 2);
    const numer = _.sum(numerParts);
    const denom = _.sum(denomParts);

    const m = numer / denom;
    const b = yMean - m * xMean;

    debug.log(
      `cal:linear ${JSON.stringify({
        x,
        y,
        xMean,
        yMean,
        numerParts,
        denomParts,
        numer,
        denom,
        b,
        m,
      })}`
    );
    if (!acceptableCoefficient(m))
      throw new CalibrationError(`calibration failed: m=${m}`);
    if (!acceptableOffset(b))
      throw new CalibrationError(`calibration failed: b=${b}`);
    return new DataProto.CalibrationCoefficients({ values: [b, m] });
  }
}

export function getCurveForSensor(
  curveType: DataProto.CurveType
): CalibrationCurve {
  switch (curveType) {
    case DataProto.CurveType.CURVE_POWER:
      return new PowerCalibrationCurve();
    case DataProto.CurveType.CURVE_EXPONENTIAL:
      return new ExponentialCalibrationCurve();
    case DataProto.CurveType.CURVE_LINEAR:
      return new LinearCalibrationCurve();
    default:
      throw new Error(`unkonwn calibration curve type`);
  }
}
