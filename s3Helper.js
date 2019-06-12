const AWS = require('aws-sdk');
const fs = require('fs');

class S3Helper {
  constructor() {
    const config = JSON.parse(fs.readFileSync(process.cwd() + '/fileshipper.json').toString());

    this.s3 = new AWS.S3({
      region: config.s3.region,
      params: {
        Bucket: config.s3.bucketName
      }
    });
  }
  upload(key, body) {
    return new Promise((resolve, reject) => {
      this.s3.upload(
        {
          Body: body,
          Key: key
        },
        (err, data) => {
          if (err) return reject(err);

          return resolve(data);
        }
      );
    });
  }
}

module.exports = { s3Helper: new S3Helper() };
