# Installation

1. Install nodejs from https://nodejs.org/en/download/

2. Clone this repository.

3. Open a terminal, change to the cloned location and run `npm install`

# Usage

The tool works by building a single modalities calibration settings and
appending them to an existing collection of other calibrations. Using ths
approach we can use this for solo-modalities as well as the omni module on
FKUW.

In order to append/write a pH calibration to a file named `omni-cal.fkpb` you
would use this command:


```
/run.sh --file omni-cal.fkpb --ph --exponential 1,1 2,2 3,3
```

The `--ph` flag is required, running this multiple times will overwrite any
previous calibration for that modality. The arguments to `--exponential` are
three pairs of comma separated values. The first value is the reference value
and the second is the observed voltage.

To see the contents of an existing calibration file you can use the `--json/-j`
flag along with `-file`


```
./run.sh --file omni-cal.fkpb --json
```

This will echo the JSON representation of the calibration data to the terminal.

You can pass `--help` to get help:

```
  cli-cal git:(main) ✗ ./run.sh --help
Options:
      --version      Show version number                               [boolean]
  -m, --modality     modality                                           [number]
      --ph                                                             [boolean]
      --ec                                                             [boolean]
      --do                                                             [boolean]
      --temp                                                           [boolean]
      --orp                                                            [boolean]
  -l, --linear       linear curve                                        [array]
  -e, --exponential  exponential curve                                   [array]
  -f, --file         file to populate
  -j, --json         show json for file                                [boolean]
  -h, --help         Show help                                         [boolean]
```
