import yargs /*, { hideBin }*/ from "yargs";
import { fk_data as DataProto } from "fk-data-protocol/fk-data";
import {
  PendingCalibration,
  LinearCalibrationCurve,
  ExponentialCalibrationCurve,
  PendingCalibrationPoint,
  CalibrationError,
} from "./model";
import fs from "fs/promises";

const argv = yargs
  .option("modality", {
    alias: "m",
    description: "modality",
    type: "number",
  })
  .option("ph", {
    type: "boolean",
  })
  .option("ec", {
    type: "boolean",
  })
  .option("do", {
    type: "boolean",
  })
  .option("temp", {
    type: "boolean",
  })
  .option("orp", {
    type: "boolean",
  })
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
  .option("file", {
    alias: "f",
    description: "file to populate",
    type: "file",
  })
  .option("json", {
    alias: "j",
    description: "show json for file",
    type: "boolean",
  })
  .help()
  .alias("help", "h").argv;

if (argv.json) {
  if (!argv.file) {
    throw new Error("file is required");
  }
  fs.readFile(argv.file)
    .then((data) => {
      return DataProto.ModuleConfiguration.decodeDelimited(data);
    })
    .then((existing) => {
      console.log(`${JSON.stringify(existing, null, 2)}`);
    });
} else {
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

  const getModality = () => {
    const FK_MODULES_KIND_WATER_PH = 0x09;
    const FK_MODULES_KIND_WATER_EC = 0x10;
    const FK_MODULES_KIND_WATER_DO = 0x11;
    const FK_MODULES_KIND_WATER_TEMP = 0x12;
    const FK_MODULES_KIND_WATER_ORP = 0x13;

    if (argv.ph) {
      return FK_MODULES_KIND_WATER_PH;
    }
    if (argv.do) {
      return FK_MODULES_KIND_WATER_DO;
    }
    if (argv.temp) {
      return FK_MODULES_KIND_WATER_TEMP;
    }
    if (argv.ec) {
      return FK_MODULES_KIND_WATER_EC;
    }
    if (argv.orp) {
      return FK_MODULES_KIND_WATER_ORP;
    }

    throw new CalibrationError("Modality is required");
  };

  console.log("cal-argv", argv);

  const curve = getCurve();
  const calibration = curve.calculate(getPending());

  calibration.kind = getModality();

  console.log(`cal-done: ${JSON.stringify(calibration, null, 2)}`);

  const config = DataProto.ModuleConfiguration.create({
    calibrations: [calibration],
  });

  const encoded = Buffer.from(
    DataProto.ModuleConfiguration.encodeDelimited(config).finish()
  );
  const hex = encoded.toString("hex");
  console.log(`cal-hex`, encoded.length, hex);

  if (argv.file) {
    fs.readFile(argv.file)
      .then(
        (data) => {
          const decoded = DataProto.ModuleConfiguration.decodeDelimited(data);
          return decoded.calibrations;
        },
        (err) => {
          console.log("creating new file");
          return [];
        }
      )
      .then((existing) => {
        const keeping = existing.filter(
          (c: DataProto.Calibration) => c.kind != calibration.kind
        );
        return [...keeping, calibration];
      })
      .then((calibrations) => {
        const config = DataProto.ModuleConfiguration.create({
          calibrations: calibrations,
        });

        const encoded = Buffer.from(
          DataProto.ModuleConfiguration.encodeDelimited(config).finish()
        );

        console.log(encoded.toString("hex"));

        return fs.writeFile(argv.file, encoded);
      });
  }
}
