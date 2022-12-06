import { fk_data as DataProto } from "fk-data-protocol/fk-data";
import {
  PendingCalibration,
  LinearCalibrationCurve,
  ExponentialCalibrationCurve,
  PendingCalibrationPoint,
} from "./model";

console.log(ExponentialCalibrationCurve, LinearCalibrationCurve);

// Reference, Uncalibrated, Factory
const pending = new PendingCalibration("module-id", [
  new PendingCalibrationPoint(0, [0], [0], [0]),
  new PendingCalibrationPoint(1, [0], [0], [0]),
  new PendingCalibrationPoint(2, [0], [0], [0]),
]);

const curve = new ExponentialCalibrationCurve();
const calibration = curve.calculate(pending);
console.log(`cal-done: ${JSON.stringify(calibration)}`);

const config = DataProto.ModuleConfiguration.create({
  calibration: calibration,
});

const encoded = Buffer.from(
  DataProto.ModuleConfiguration.encodeDelimited(config).finish()
);
const hex = encoded.toString("hex");
console.log(`cal-hex`, encoded.length, hex);
