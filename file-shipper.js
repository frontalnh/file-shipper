const fs = require('fs');
const path = require('path');
const CryptoJs = require('crypto-js');
const { from } = require('rxjs');
const { filter, map, tap, mergeMap } = require('rxjs/operators');
const { s3Helper } = require('./s3Helper');

class FileShipper {
  // read all files in directory and compare with .checksum/<file_name>
  // extract not matching file and which do not have matching checksum file which means new file!
  // ship not matching file and update checksum
  // remove older than 7 days
  constructor() {
    this.pairs = [];
    this.filePairs = [];
  }
  start() {
    return new Promise((resolve, reject) => {
      this.createChecksumDir();
      const filePairs = this.harvest();

      console.log('File Pairs: ', filePairs);

      from(filePairs)
        .pipe(
          filter(this._isToBeUploadedToS3),
          mergeMap(filePair => {
            const [inputFilePath] = filePair;

            return from(this.shipToS3(inputFilePath));
          }),
          tap(inputFilePath => {
            this.createChecksumFromPath(inputFilePath);
          })
        )
        .subscribe({
          complete: () => {
            return resolve(true);
          },
          error: err => {
            console.log(err);
            return reject(err);
          }
        });
    });
  }

  createChecksumDir() {
    if (!fs.existsSync(process.cwd() + '/.checksum')) {
      fs.mkdirSync(process.cwd() + '/.checksum');
    }
  }

  // harvest collects single file
  harvest() {
    const { dirPairs: pairs } = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), './fileshipper.json')).toString()
    );

    this.pairs = pairs;

    const filePairs = this.extractFilePair(pairs);

    return filePairs;
  }

  _isToBeUploadedToS3(filePair) {
    const [inputFile] = filePair;
    const [inputFileName] = inputFile.split('/').slice(-1);

    const checksumPath = process.cwd() + '/.checksum/' + inputFileName;
    const hasChecksum = fs.existsSync(checksumPath);

    console.log('has checksum: ', hasChecksum);
    if (!hasChecksum) return true;

    const existChecksum = fs.readFileSync(checksumPath).toString();
    const fileBuffer = fs.readFileSync(inputFile);
    const currentChecksum = CryptoJs.SHA1(fileBuffer.toString()).toString();
    const isTobeUpdated = currentChecksum != existChecksum;

    console.log('is to be updated: ', isTobeUpdated);
    if (isTobeUpdated) return true;

    return false;
  }

  extractFilePair(dirPairs) {
    const result = [];
    for (const pair of dirPairs) {
      const files = fs.readdirSync(pair[0]);

      files.forEach(file => {
        result.push([pair[0] + '/' + file, pair[1] + '/' + file]);
      });
    }

    return result;
  }

  createChecksumFromPath(path) {
    console.log('create checksum!!');
    const [fileName] = path.split('/').slice(-1);
    const fileBuffer = fs.readFileSync(path);
    const file = CryptoJs.SHA1(fileBuffer.toString()).toString();
    console.log(process.cwd() + '/.checksum' + '/' + fileName);

    fs.writeFileSync(process.cwd() + '/.checksum' + '/' + fileName, file);
  }

  async shipToS3(inputFilePath) {
    try {
      const file = fs.readFileSync(inputFilePath);
      const [fileName] = inputFilePath.split('/').slice(-1);

      await s3Helper.upload(
        fileName
          .split('.')
          .slice(0, -1)
          .join(''),
        file
      );

      return inputFilePath;
    } catch (err) {
      console.log(err);
    }
  }
}

module.exports = { fileShipper: new FileShipper() };
