const asyncBusboy = require('async-busboy');

const Fex = require('./exception');

// 解析文件数据
async function multer (options) {
  const contentType = this.req.headers['content-type'];
  if (!contentType.includes('multipart')) {
    throw new Fex('Content-Type must be multipart/*');
  }
  const filePromises = [];
  await asyncBusboy(this.req, {
    onFile: async function (fieldname, file, filename, encoding, mimetype) {
      const filePromise = new Promise((resolve, reject) => {
        const bufs = [];
        file
          .on('error', err => {
            file.resume();
            reject(err);
          })
          .on('data', data => {
            bufs.push(data);
          })
          .on('end', () => {
            const buf = Buffer.concat(bufs);
            resolve({
              size: buf.length,
              encoding: encoding,
              fieldname: fieldname,
              filename: filename,
              mimeType: mimetype,
              data: buf
            });
          });
      });
      filePromises.push(filePromise);
    }
  });
  const files = [];
  let totalSize = 0;
  for (const filePromise of filePromises) {
    const file = await filePromise;
    const fileExt = file.filename.split('.').pop();
    // 验证文件类型
    if (!_verifyExt(fileExt, options && options.include, options && options.exclude)) {
      throw new Fex(`Does not support files of file type ${fileExt}`);
    }

    // 验证单个文件的大小
    const { verid, confSize } = _verifySingleFileSize(file.size, options && options.singleLimit);
    if (!verid) {
      throw new Fex(`file: ${file.filename}，size cannot exceed ${confSize} bytes`);
    }

    // 计算总大小
    totalSize += file.size;

    files.push(file);
  }

  // 验证文件数量
  const { verid, confNums = 10 } = _verifyFileNums(files.length, options && options.nums);
  if (!verid) {
    throw new Fex(`The number of files cannot exceed ${confNums}`);
  }

  // 验证文件总大小
  const { verid: verid1, confTotalSize } = _verifyTotalFileSize(totalSize, options && options.totalLimit);
  if (!verid1) {
    throw new Fex(`The total file size cannot exceed ${confTotalSize} bytes`);
  }

  return files;
}

function _verifyExt (ext, include, exclude) {
  const fileInclude = include;
  const fileExclude = exclude;
  // 只要有fileInclude，取fileInclude
  if (fileInclude) {
    if (!Array.isArray(fileInclude)) {
      throw new Error('file include必须是array');
    }
    fileInclude.map(item => fileInclude.push(item.toLocaleUpperCase()));
    return fileInclude.includes(ext);
  }

  // 有fileExclude,无fileInclude
  if (!fileInclude && fileExclude) {
    if (!Array.isArray(fileExclude)) {
      throw new Error('file exclude必须是array');
    }
    fileExclude.map(item => fileExclude.push(item.toLocaleUpperCase()));
    return !fileExclude.includes(ext);
  }

  // 都没有
  if (!fileInclude && !fileExclude) return true;
};

function _verifySingleFileSize (size, singleLimit) {
  const confSize = singleLimit;
  return {
    verid: confSize ? (confSize > size) : true,
    confSize
  };
}

function _verifyFileNums (nums, fileNums) {
  const confNums = fileNums;
  return {
    verid: confNums ? (confNums > nums) : true,
    confNums
  };
}

function _verifyTotalFileSize (size, totalLimit) {
  const confTotalSize = totalLimit;

  return {
    verid: confTotalSize ? (confTotalSize > size) : true,
    confTotalSize
  };
}

module.exports = multer;
