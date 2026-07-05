const { toCsvRows, toCsvText } = require("./report");

const openFile = (filePath, fileType = "xlsx") =>
  new Promise((resolve, reject) => {
    wx.openDocument({
      filePath,
      fileType,
      showMenu: true,
      success: resolve,
      fail: reject,
    });
  });

const writeTextFile = (fileName, content) => {
  const fs = wx.getFileSystemManager();
  const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
};

const exportCsv = async (tasks, fileName = "医学装备科任务清单.csv") => {
  const csv = toCsvText(toCsvRows(tasks));
  const filePath = writeTextFile(fileName, csv);
  await openFile(filePath, "csv");
  return filePath;
};

const exportXlsx = async (tasks, fileName = "医学装备科任务清单.xlsx") => {
  try {
    const XLSX = require("xlsx");
    const rows = toCsvRows(tasks);
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "任务清单");
    const out = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const buffer = out instanceof ArrayBuffer ? out : out.buffer;
    const fs = wx.getFileSystemManager();
    const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
    fs.writeFileSync(filePath, buffer);
    await openFile(filePath, "xlsx");
    return filePath;
  } catch (error) {
    return exportCsv(tasks, fileName.replace(/\.xlsx$/i, ".csv"));
  }
};

module.exports = {
  exportCsv,
  exportXlsx,
};
