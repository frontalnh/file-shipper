const { fileShipper } = require('./file-shipper');

describe('harvest', () => {
  it('read fileshipper config file', async () => {
    await fileShipper.start();
  });
});
