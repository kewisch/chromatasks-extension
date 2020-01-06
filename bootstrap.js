
var { ExtensionSupport } = ChromeUtils.import(
  "resource:///modules/ExtensionSupport.jsm"
);

var { Services } = ChromeUtils.import(
  "resource://gre/modules/Services.jsm"
);

function startup(data, reason) {
  ExtensionSupport.registerWindowListener("chromatasks", {
    chromeURLs: ["chrome://messenger/content/messenger.xul"],
    onLoadWindow: function(window) {
      Services.scriptloader.loadSubScript("chrome://chromatasks/content/chromatasks.js", window);
    }
  });
}

function shutdown() {
  ExtensionSupport.unregisterWindowListener("chromatasks");

  for (let window of ExtensionSupport.openWindows) {
    let sheet = window.document.getElementById("chromatasks-styles");
    if (sheet) {
      sheet.remove();
    }
  }
}

function install() {}
function uninstall() {}
