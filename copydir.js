const fs = require("fs");
const path = require("path");

/**
 * 同步复制文件夹（覆盖目标目录）
 * @param {string} source 源文件夹路径
 * @param {string} target 目标文件夹路径
 */
function copyFolderSync(source, target) {
  fs.cpSync(source, target, {
    recursive: true,
    force: true,
    errorOnExist: false,
  });
}

// 使用示例
try {
  copyFolderSync(
    "./lib",
    "D:/Code/Koishi/koishi-main/node_modules/@quanhuzeyu/koishi-plugin-qz-siliconflow/lib"
  );
  console.log("文件夹复制完成");
} catch (err) {
  console.error("复制失败:", err);
}
