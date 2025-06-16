const path = require('path');

module.exports = {
  // Bot configuration
  botName: "WhatsAppOCRBot",
  initialDelay: 5000,  // 5 seconds before first message
  messageDelay: 1000,  // 1 second between messages
  
  // OCR validation parameters
  validName: "Angel Vilca",
  minOperationLength: 5,
  maxDateDifference: 1, // maximum days difference for date validation
  amountToReject: "500",
  
  // File paths
  mensajesPath: path.join(__dirname, 'mensajes.json'),
  mediaPath: path.join(__dirname, 'media'),
  logsPath: path.join(__dirname, 'logs'),
  
  // Create directories if they don't exist
  createDirs: function() {
    const fs = require('fs-extra');
    [this.mediaPath, this.logsPath].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }
};
