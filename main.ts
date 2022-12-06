import yargs /*, { hideBin }*/ from "yargs";
import { fk_data as DataProto } from "fk-data-protocol/fk-data";
import {
  PendingCalibration,
  LinearCalibrationCurve,
  ExponentialCalibrationCurve,
  PendingCalibrationPoint,
  CalibrationError,
} from "./model";

const argv = yargs
  .option("linear", {
    alias: "l",
    description: "linear curve",
    type: "array",
  })
  .option("exponential", {
    alias: "e",
    description: "exponential curve",
    type: "array",
  })
  .help()
  .alias("help", "h").argv;

const getCurve = () => {
  if (argv.exponential) {
    return new ExponentialCalibrationCurve();
  } else {
    return new LinearCalibrationCurve();
  }
};

const getPending = () => {
  let values = [];
  if (argv.exponential) {
    values = argv.exponential;
  }
  if (argv.linear) {
    values = argv.linear;
  }

  if (values.length == 0) {
    throw new CalibrationError("no curve selected");
  }

  // Reference, Uncalibrated, Factory
  return new PendingCalibration(
    values.map((v: string, i: number) => {
      const parts = v.toString().split(",");
      console.log(i, parts);
      if (parts.length != 2) {
        throw new CalibrationError(
          "Expected calibration point in the form REFERENCE,SENSED"
        );
      }
      return new PendingCalibrationPoint(
        i,
        [Number(parts[0])],
        [Number(parts[1])],
        [0]
      );
    })
  );
};

console.log(argv);

const curve = getCurve();
const calibration = curve.calculate(getPending());
console.log(`cal-done: ${JSON.stringify(calibration)}`);

const config = DataProto.ModuleConfiguration.create({
  calibration: calibration,
});

const encoded = Buffer.from(
  DataProto.ModuleConfiguration.encodeDelimited(config).finish()
);
const hex = encoded.toString("hex");
console.log(`cal-hex`, encoded.length, hex);
