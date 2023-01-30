/**
 * Global utility class
 *
 * @author : MattF
 * @company : DE.TEC.TOR. srl
 * @version : 1.0.0
 */
import alertify from "alertifyjs/build/alertify";
import { default as Util } from "./Util";

class Notifier {
  static setup() {
    alertify.defaults.transition = "slide";
    alertify.defaults.theme.ok = "btn btn-success btn-sm";
    alertify.defaults.theme.cancel = "btn btn-danger";
    alertify.defaults.theme.input = "form-control";
    alertify.defaults.notifier.position = "top-center";
  }
  /**
   * Notifier
   *
   * @param title
   * @param msg
   * @param type      (e: error, w: warning, i: info)
   */
  static notify(msg = "i", type = "i", delay = 0) {
    let _msg = Util.isValid(msg) ? msg : "";
    let _type = "";
    let _delay = Util.isValidNumber(delay) ? delay : 5;

    // Select color and icon
    switch (type) {
      case "e":
        _type = "error";
        break;
      case "w":
        _type = "warning";
        break;
      case "s":
        _type = "success";
        break;
      case "i":
      default:
        _type = "message";
        break;
    }
    alertify.notify(_msg, _type, _delay);
  }
}

export default Notifier;
