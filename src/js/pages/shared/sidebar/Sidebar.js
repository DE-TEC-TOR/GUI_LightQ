/**
 * Device sidebar menu for monitor pages (DAQ, calibration) -> for device integrated software
 *
 * @author : MattF
 * @company : DE.TEC.TOR. srl
 * @version : 1.0.0
 */
import Util from "../../../core/Util";
import Button from "../../../components/controllers/Button";
import { FreeTextBox } from "../../../components/controllers/TextBoxes";
import { FileIn } from "../../../components/controllers/FileUploads";
import Switch from "../../../components/controllers/Switch";
import SelectBox from "../../../components/controllers/SelectBox";
import CircleIndicator from "../../../components/indicators/CircleIndicator";
import { GraphRound } from "../../../components/graphics/Graphs";
import { Panel } from "../../../components/graphics/Panels";
import {
  conn_error,
  formatDate,
  validateNumInput,
  getDeltaDate,
  notifyError,
} from "../../../core/Helpers";
import Loader from "../../../components/indicators/Loader";

const DEF_INPUT_CALIB = {
  posXchannels: [],
  posYchannels: [],
  intChannels: [],
  rngChannels: [],
};

class Sidebar {
  constructor(
    detConfig,
    modal,
    webSock,
    pageGraphs,
    inputCalib = DEF_INPUT_CALIB
  ) {
    this.detConfig = detConfig;
    this.devName = detConfig.devName;
    this.hasPos = detConfig.hasPos;
    this.hasRng = detConfig.hasRng;
    this.hasHV = detConfig.hasHV;
    this.dataBaseURL = "http://" + detConfig.ws_address + detConfig.data_path;
    this.calibBaseURL = "http://" + detConfig.ws_address + detConfig.calib_path;
    this.controlUnitStatus = 99;
    this.HVStatus = 99;
    this.cameraStatus = 99;
    this.daqStatus = 0; //0 -> idle - 1 -> daqRunning - 2 -> streamingRunning - 3 -> aQuracyDaqRunning - 4 -> backgroundDaqRunning
    this.settings = {
      sampling_rate: "",
      sampling_mode: "",
      daq_trigger: "",
      first_channel: "",
      exposure: "",
      tot_daq_time: "",
      use_pos_calib: "",
      pos_calib_filename: "",
      use_rng_calib: "",
      rng_calib_filename: "",
      use_bkg: "",
      bkg_filename: "",
      enable_range: this.hasRng.toString(),
      enable_profiles: this.hasPos.toString(),
      datetime: "",
    };
    this.bkg_settings = {
      sampling_rate: "100", //to be set to 1000
      sampling_mode: "0",
      daq_trigger: "1",
      first_channel: "1",
      exposure: "",
      tot_daq_time: "",
      use_calib_profile: "false",
      profile_calib_filename: "",
      use_calib_range: "false",
      range_calib_filename: "",
      use_bkg: "",
      bkg_filename: "",
      enable_range: this.hasRng.toString(),
      enable_profiles: this.hasPos.toString(),
      datetime: "",
    };
    this.components = {
      status: {},
      settings: {},
      calibration: {},
      background: {},
      acquisition: {},
      logbook: {},
      managePosCalib: {},
      manageRngCalib: {},
    };
    this.configs_array = [];
    this.graph_array = pageGraphs;
    this.calibFields = inputCalib;
    this.panels = { shared: {}, daq: {}, posCalib: {}, rngCalib: {} };
    this.modal = modal; //reference to the main page shared modal
    this.ws = webSock; //reference to the main page socket
    this.errorList = [];
    this.filesList = {
      posDataFiles: [],
      rngDataFiles: [],
      posCalibFiles: [],
      rngCalibFiles: [],
      backgroundFiles: [],
    }; //stored data, calibration, and background files
    this.calib_param = {
      filename: "",
      X_calib: [],
      Y_calib: [],
      Int1_calib: 1.0,
      Int2_calib: 1.0,
      filename_Z: "",
      Z_calib: [],
    };
  }

  initConfig() {
    let th = this;
    if (this.ws.isConnected()) {
      //if WS connected, proceed with initial configuration
      this.ws.send("updateConfig", "init");
    } else {
      //if WS not yet connected, timeout before initial configuration to give time for connecting
      setTimeout(function () {
        if (th.ws.isConnected()) {
          th.ws.send("updateConfig", "init");
        } else {
          //alert if no connection and circular indicator set to 99 state
          conn_error();
          if (th.devName != "aQuracy") {
            th.components.status.hvStatus_ind.update(99);
          } else {
            th.components.status.camStatus_ind.update(99);
          }
          th.components.status.cuStatus_ind.update(99);
        }
      }, 1100);
    }
  }

  build() {
    this.createIndicators();
    this.createControls();
    this.createButtons();
    this.fillPanels();
  }

  createIndicators() {
    let th = this;
    //------------------------------------------------STATUS INDICATORS
    //Control unit status indicator
    let circ_device = new CircleIndicator("device_status", "Control Unit");
    circ_device.handlerEvent("click", function () {
      if (th.ws.isConnected()) {
        if (circ_device.getState() == 0 && th.errorList.length == 0) {
          alertify.success("Everything is fine!");
          return;
        }
        if (circ_device.getState() == 99) {
          alertify.error("No connection to the device");
          return;
        }
        th.fillErrorModal();
        th.modal.show();
      } else {
        conn_error();
      }
    });
    this.components.status.cuStatus_ind = circ_device;
    //HV control indicator
    if (this.hasHV) {
      let circ_hv = new CircleIndicator("hv_status", "HV");
      circ_hv.handlerEvent("updateHV", function (x, state) {
        circ_hv.updateHV(state);
      });
      circ_hv.handlerEvent("click", function () {
        if (th.ws.isConnected()) {
          switch (circ_hv.getState()) {
            case 0:
              alertify.error("HV OFF");
              break;
            case 1:
              alertify.success("HV ON and in range");
              break;
            case 2:
              alertify.error("HV out of range");
              break;
            case 99:
              alertify.error("No connection to the device");
              break;
            default:
              alertify.error("Internal anomaly. Call the manufacturer.");
              break;
          }
        } else {
          conn_error();
        }
      });
      this.components.status.hvStatus_ind = circ_hv;
    }
    //------------------------------------------------MEMORY INDICATOR
    let memory_ind = new GraphRound("memory_status", "Memory Usage");
    this.components.status.memory_ind = memory_ind;
    //-----------------------------------------DAQ GIF LOADER
    let loader = new Loader("daq_loader");
    this.components.acquisition.loader = loader;
    //----------------------------------------------CALIBRATION PAGES
    //----------------------------------------------UPLOADED POS CALIB FILE
    if (this.hasPos) {
      let uploaded_posCalib = new FreeTextBox("uploaded_posCalib", "File");
      this.components.managePosCalib.uploaded_file = uploaded_posCalib;
    }
    //----------------------------------------------UPLOADED RNG CALIB FILE
    if (this.hasRng) {
      let uploaded_rngCalib = new FreeTextBox("uploaded_rngCalib", "File");
      this.components.manageRngCalib.uploaded_file = uploaded_rngCalib;
    }
  }

  createControls() {
    let th = this;
    //------------------------------------------------DAQ SETTINGS
    //******Sampling mode
    let sampl_mode = new SelectBox("sampling_mode", "S. Mode");
    sampl_mode.handlerEvent("updateSM", function (ref, data) {
      sampl_mode.updateSM(data);
    });
    this.components.settings.samplMode = sampl_mode;
    this.configs_array.push(sampl_mode);

    if (this.devName != "aQuracy") {
      //******Sampling rate
      let sampl_rate = new SelectBox("sampling_rate", "S. Rate [ms]");
      sampl_rate.handlerEvent("change", function () {
        th.settings.sampling_rate = $(sampl_rate.getId(true)).val();
      });
      sampl_rate.handlerEvent("updateSR", function (ref, data) {
        sampl_rate.updateSR(data);
      });
      this.components.settings.samplRate = sampl_rate;
      this.configs_array.push(sampl_rate);

      this.components.settings.samplMode.handlerEvent("change", function () {
        th.settings.sampling_mode = $(
          th.components.settings.samplMode.getId(true)
        ).val();
        if ($(th.components.settings.samplMode.getId(true)).val() != "0") {
          th.components.settings.samplRate.disable();
        } else {
          th.components.settings.samplRate.enable();
        }
      });

      if (this.devName == "QUBENext" || this.devName == "QEye") {
        //******First channel selection - QUBENext and QEye only
        let firstCh = new SelectBox("first_channel", "1st Channel");
        firstCh.handlerEvent("change", function () {
          th.settings.first_channel = $(firstCh.getId(true)).val();
        });
        this.components.settings.firstCh = firstCh;
        this.configs_array.push(firstCh);
      }
      //------------------CALIBRATION CONTROLS
      if (this.hasPos) {
        let sel_text = this.hasRng ? "Pos calib file" : "Calib file";
        let switch_text = this.hasRng
          ? "Apply pos calibration"
          : "Apply calibration";
        //POS CALIBRATION SELECTION box and switch
        let select_pos_calib = new SelectBox(
          "select_pos_calibration",
          sel_text
        );
        select_pos_calib.handlerEvent("change", function () {
          th.settings.pos_calib_filename = $(
            select_pos_calib.getId(true)
          ).val();
        });
        let pos_calib_switch = new Switch("pos_calib_switch", switch_text);
        pos_calib_switch.handlerEvent("click", function () {
          if (th.daqStatus == 1 || th.daqStatus == 2) {
            alertify.warning("Data streaming or DAQ ongoing. Stop before!");
            return;
          } else {
            if (pos_calib_switch.getState()) {
              pos_calib_switch.switch_state();
              // use_calib = pos_calib_switch.getState();
              th.settings.use_pos_calib = pos_calib_switch
                .getState()
                .toString();
            } else if ($(select_pos_calib.getId(true)).val()) {
              pos_calib_switch.switch_state();
              // use_calib = calib_switch.getState();
              th.settings.use_pos_calib = pos_calib_switch
                .getState()
                .toString();
            } else {
              alertify.warning("No calibration file selected");
            }
          }
        });
        this.components.calibration.select_pos_calib = select_pos_calib;
        this.components.calibration.switch_pos_calib = pos_calib_switch;
      }
      if (this.hasRng) {
        //RNG CALIBRATION SELECTION box and switch
        let select_rng_calib = new SelectBox(
          "select_rng_calibration",
          "Z calib file"
        );
        select_rng_calib.handlerEvent("change", function () {
          // calib_file = $(select_mlic_calib.getId(true)).val();
          if ($(select_rng_calib.getId(true)).val()) {
            th.settings.rng_calib_filename = $(
              select_rng_calib.getId(true)
            ).val();
          } else {
            th.settings.rng_calib_filename = "";
          }
        });
        let rng_calib_switch = new Switch(
          "rng_calib_switch",
          "Apply Z calibration"
        );
        rng_calib_switch.handlerEvent("click", function () {
          if (th.daqStatus == 1 || th.daqStatus == 2) {
            alertify.warning("Data streaming or DAQ ongoing. Stop before!");
            return;
          } else {
            if (rng_calib_switch.getState()) {
              rng_calib_switch.switch_state();
              // use_mlic_calib = rng_calib_switch.getState();
              th.settings.use_rng_calib = rng_calib_switch
                .getState()
                .toString();
            } else if ($(select_rng_calib.getId(true)).val()) {
              rng_calib_switch.switch_state();
              // use_mlic_calib = rng_calib_switch.getState();
              th.settings.use_rng_calib = rng_calib_switch
                .getState()
                .toString();
            } else {
              alertify.warning("No calibration file selected");
            }
          }
        });
        this.components.calibration.select_rng_calib = select_rng_calib;
        this.components.calibration.switch_rng_calib = rng_calib_switch;
      }
      //------------------BACKGROUND CONTROLS
      let select_bkg = new SelectBox("select_background", "Bkg file");
      select_bkg.handlerEvent("change", function () {
        if ($(select_bkg.getId(true)).val()) {
          th.settings.bkg_filename = $(select_bkg.getId(true)).val();
        } else {
          th.settings.bkg_filename = "";
        }
      });
      this.components.background.select_bkg = select_bkg;
      //BACKGROUND ACTIVATION switch
      let bkg_switch = new Switch("bkg_switch", "Subtract background");
      bkg_switch.handlerEvent("click", function () {
        if (th.daqStatus != 0) {
          alertify.warning("Data streaming or DAQ ongoing. Stop before!");
          return;
        } else {
          if (bkg_switch.getState()) {
            bkg_switch.switch_state();
            // use_bkg = bkg_switch.getState();
            th.settings.use_bkg = bkg_switch.getState().toString();
          } else if ($(select_bkg.getId(true)).val()) {
            bkg_switch.switch_state();
            // use_bkg = bkg_switch.getState();
            th.settings.use_bkg = bkg_switch.getState().toString();
          } else {
            alertify.warning("No background source selected");
          }
        }
      });
      this.components.background.bkg_switch = bkg_switch;
    } else {
      //aQuracy settings
      //******Camera exposure selection - aQuracy only
      let exposure = new SelectBox("exposure", "Exposure [ms]");
      exposure.handlerEvent("change", function () {
        th.settings.exposure = $(exposure.getId(true)).val();
      });
      exposure.handlerEvent("updateExposure", function (ref, data) {
        exposure.updateExposure(data);
      });
      this.components.settings.exposure = exposure;
      this.configs_array.push(exposure);
      //******Tot acquisition time selection - aQuracy only
      let tot_daq_time = new SelectBox("tot_daq_time", "TOT time [s]");
      tot_daq_time.handlerEvent("change", function () {
        th.settings.tot_daq_time = $(tot_daq_time.getId(true)).val();
      });
      tot_daq_time.handlerEvent("updateDAQtime", function (ref, data) {
        tot_daq_time.updateDaqTotTime(data);
      });
      this.components.settings.totTime = tot_daq_time;
      this.configs_array.push(tot_daq_time);
    }
    //------------------------------------MODULE SWITCHES
    if (this.hasPos && this.hasRng) {
      let switch_profiles = new Switch("switch_profiles", "Enable pos");
      let switch_range = new Switch("switch_range", "Enable rng");
      switch_profiles.handlerEvent("click", function () {
        if (th.daqStatus == 1 || th.daqStatus == 2) {
          alertify.warning("Data streaming or DAQ ongoing. Stop before!");
          return;
        } else {
          switch_profiles.switch_state();
          th.settings.enable_profiles = switch_profiles.getState().toString();
        }
      });
      switch_range.handlerEvent("click", function () {
        if (th.daqStatus == 1 || th.daqStatus == 2) {
          alertify.warning("Data streaming or DAQ ongoing. Stop before!");
          return;
        } else {
          switch_range.switch_state();
          th.settings.enable_range = switch_range.getState().toString();
        }
      });
      this.components.settings.switchPos = switch_profiles;
      this.components.settings.switchRng = switch_range;
    }
    //------------------------------------CALIBRATION PAGES CONTROLS
    if (this.hasPos) {
      let upload_posCalib = new FileIn("upload_posCalib", "Upload file");
      this.components.managePosCalib.form_upload_file = upload_posCalib;
    }
    if (this.hasRng) {
      let upload_rngCalib = new FileIn("upload_rngCalib", "Upload file");
      this.components.manageRngCalib.form_upload_file = upload_rngCalib;
    }
  }

  createButtons() {
    let th = this;
    //--------------------------------------RESET ALARMS BUTTON--------------------------------------//
    let btn_reset_alarms = new Button("btn_reset_alarms", "Reset Alarms", 1);
    btn_reset_alarms.addClickAction(function () {
      if (th.ws.isConnected()) {
        th.ws.send("reset_alarms");
        Util.trig("device_status", "update", 0);
        th.errorList = [];
      } else {
        conn_error();
      }
    });
    this.components.status.btnResetAlarms = btn_reset_alarms;
    //--------------------------------------RESET COUNTERS BUTTON--------------------------------------//
    let btn_reset_counters = new Button(
      "btn_reset_counters",
      "Reset Counters",
      1
    );
    btn_reset_counters.addClickAction(function () {
      if (th.ws.isConnected()) {
        if (th.daqStatus == 1) {
          alertify.warning(
            "DAQ ongoing. Stop data streaming before performing a counter reset!"
          );
          return;
        }
        if (th.daqStatus == 2) {
          for (let i = 0; i < th.graph_array.length; i++) {
            Util.trig(th.graph_array[i].getId(), "reset");
          }
          th.ws.send("reset_counters", "restart");
          return;
        }
        th.ws.send("reset_counters");
      } else {
        conn_error();
      }
    });
    this.components.settings.btnResetCounters = btn_reset_counters;
    //--------------------------------------SELECT MEASURE BUTTONS - LOGBOOK--------------------------------------//
    if (this.hasPos) {
      let meas_text = this.hasRng ? "Select pos measure" : "Select measure";
      let btn_select_pos_measure = new Button(
        "btn_select_measure",
        meas_text,
        1
      );
      btn_select_pos_measure.addClickAction(function () {
        if (th.ws.isConnected()) {
          if (th.daqStatus == 1 || th.daqStatus == 2) {
            alertify.warning("DAQ ongoing. Stop data streaming before!");
            return;
          } else {
            th.ws.send_to_logger("log_scan_profile_files");
          }
        } else {
          conn_error();
        }
      });
      this.components.logbook.btnSelectPosFile = btn_select_pos_measure;
    }
    if (this.hasRng) {
      let btn_select_rng_measure = new Button(
        "btn_select_range_measure",
        "Select Z Measure",
        1
      );
      btn_select_rng_measure.addClickAction(function () {
        if (th.ws.isConnected()) {
          if (th.daqStatus == 1 || th.daqStatus == 2) {
            alertify.warning("DAQ ongoing. Stop data streaming before!");
            return;
          } else {
            th.ws.send_to_logger("log_scan_range_files");
          }
        } else {
          conn_error();
        }
      });
      this.components.logbook.btnSelectRngFile = btn_select_rng_measure;
    }
    //--------------------------------------ACQUISITION BUTTON--------------------------------------//
    let btn_acq = new Button(
      "btn_acq",
      '<span id="measurePlaySpan" class="mdi mdi-play"></span>',
      2
    );
    btn_acq.addClickAction(function () {
      th.toggleDaq();
    });
    this.components.acquisition.btnDAQ = btn_acq;
    //--------------------------------------DATA STREAM BUTTON--------------------------------------//
    let btn_data_stream = new Button("btn_data_stream", "Start data stream", 1);
    btn_data_stream.addClickAction(function () {
      th.toggleDataStream();
    });
    this.components.acquisition.btnDataStream = btn_data_stream;
    //--------------------------------------BACKGROUND ACQUISITION BUTTON--------------------------------------//
    let btn_bkg_acq = new Button("btn_bkg_acq", "Record background", 1);
    btn_bkg_acq.addClickAction(function () {
      th.recordBackground();
    });
    this.components.background.btnBkgDaq = btn_bkg_acq;
    //-------------------------------------BACKGROUND LOGBOOK BUTTON------------------------------------------//
    let btn_bkg_logbook = new Button("btn_bkg_logbook", "Background files", 1);
    btn_bkg_logbook.addClickAction(function () {
      if (th.ws.isConnected()) {
        if (th.daqStatus != 0) {
          alertify.warning("DAQ ongoing. Stop data streaming before!");
          return;
        } else {
          th.ws.send_to_logger("log_scan_background_files");
        }
      } else {
        console.log("SOCK is not connected!");
        conn_error();
      }
    });
    this.components.background.btnBkgLogbook = btn_bkg_logbook;
    //-------------------------------------------CALIBRATION PAGES BUTTONS------------------------------------//
    if (this.hasPos) {
      //-------------------------------------------SELECT CALIB BUTTON - to select a calibration file (the reply from the device will open a modal)-------------------------------------//
      let select_posCalib = new Button(
        "select_posCalib",
        "Select Calibration File",
        1
      );
      select_posCalib.addClickAction(function () {
        if (th.ws.isConnected()) {
          th.ws.send_to_logger("log_scan_profile_calib_files");
        } else {
          console.log("SOCK is not connected!");
          conn_error();
        }
      });
      this.components.managePosCalib.select_posCalib = select_posCalib;
      //-------------------------------------------RESET BUTTON - to reset all calib fields to 1.0-------------------------------------//
      let reset_posCalib = new Button(
        "reset_posCalib",
        "Reset Calibration Factors",
        1
      );
      reset_posCalib.addClickAction(function () {
        alertify.confirm(
          "Reset?",
          "Are you sure to reset all the calibration factors to 1?",
          function () {
            th.calibFields.posXchannels.map((x) => x.update(1));
            th.calibFields.posYchannels.map((y) => y.update(1));
            th.calibFields.intChannels.map((int) => int.update(1));
            th.components.managePosCalib.uploaded_file.update("");
            th.components.managePosCalib.form_upload_file.reset();
          },
          function () {
            alertify.error("Aborted", 2);
            return;
          }
        );
      });
      this.components.managePosCalib.reset_posCalib = reset_posCalib;
      //-------------------------------------------SAVE CALIB BUTTON - to save to text file the calibration factors on screen-------------------------------------/ /
      let save_posCalib = new Button(
        "save_posCalib",
        "Save Calibration to File",
        1
      );
      save_posCalib.addClickAction(function () {
        if (th.ws.isConnected()) {
          th.ws.send_to_logger("log_scan_profile_calib_files", "hidden");
          th.fillSaveCalibrationModal("pos");
          th.modal.show();
        } else {
          console.log("SOCK is not connected!");
          conn_error();
        }
      });
      this.components.managePosCalib.save_posCalib = save_posCalib;
    }
    if (this.hasRng) {
      //-------------------------------------------SELECT CALIB BUTTON - to select a calibration file (the reply from the device will open a modal)-------------------------------------//
      let select_rngCalib = new Button(
        "select_rngCalib",
        "Select Calibration File",
        1
      );
      select_rngCalib.addClickAction(function () {
        if (th.ws.isConnected()) {
          th.ws.send_to_logger("log_scan_range_calib_files");
        } else {
          console.log("SOCK is not connected!");
          conn_error();
        }
      });
      this.components.manageRngCalib.select_rngCalib = select_rngCalib;
      //-------------------------------------------RESET BUTTON - to reset all calib fields to 1.0-------------------------------------//
      let reset_rngCalib = new Button(
        "reset_rngCalib",
        "Reset Calibration Factors",
        1
      );
      reset_rngCalib.addClickAction(function () {
        alertify.confirm(
          "Reset?",
          "Are you sure to reset all the calibration factors to 1?",
          function () {
            th.calibFields.rngChannels.map((x) => x.update(1));
            th.components.manageRngCalib.uploaded_file.update("");
            th.components.manageRngCalib.form_upload_file.reset();
          },
          function () {
            alertify.error("Aborted", 2);
            return;
          }
        );
      });
      this.components.manageRngCalib.reset_rngCalib = reset_rngCalib;
      //-------------------------------------------SAVE CALIB BUTTON - to save to text file the calibration factors on screen-------------------------------------/ /
      let save_rngCalib = new Button(
        "save_rngCalib",
        "Save Calibration to File",
        1
      );
      save_rngCalib.addClickAction(function () {
        if (th.ws.isConnected()) {
          th.ws.send_to_logger("log_scan_range_calib_files", "hidden");
          th.fillSaveCalibrationModal("rng");
          th.modal.show();
        } else {
          console.log("SOCK is not connected!");
          conn_error();
        }
      });
      this.components.manageRngCalib.save_rngCalib = save_rngCalib;
    }
  }

  fillPanels() {
    let th = this;
    /*
        ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** **
        //------------------------------------------ Panels setup ------------------------------------------//
        ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** ** **
        */
    //--------------------------------------STATUS PANEL--------------------------------------//
    let pan_status = new Panel("panel_status", "Device status");
    this.panels.shared.pan_status = pan_status;
    Object.values(this.components.status).forEach((val) => {
      th.panels.shared.pan_status.addComponent(val);
    });
    //--------------------------------------DAQ SETUP PANEL--------------------------------------//
    let pan_setup = new Panel("panel_setup", "Settings");
    this.panels.daq.pan_setup = pan_setup;
    Object.values(this.components.settings).forEach((val) => {
      th.panels.daq.pan_setup.addComponent(val);
    });
    //--------------------------------------CALIBRATION SELECTION PANEL--------------------------------------//
    let pan_calib = new Panel("panel_calibration", "Calibration");
    this.panels.daq.pan_calib = pan_calib;
    Object.values(this.components.calibration).forEach((val) => {
      th.panels.daq.pan_calib.addComponent(val);
    });
    //---------------------------------------BACKGROUND PANEL--------------------------------------//
    let pan_bkg = new Panel("panel_background", "Background");
    this.panels.daq.pan_bkg = pan_bkg;
    Object.values(this.components.background).forEach((val) => {
      th.panels.daq.pan_bkg.addComponent(val);
    });
    //--------------------------------------DAQ COMMAND PANEL--------------------------------------//
    let pan_reg = new Panel("panel_reg", "Acquisition");
    this.panels.daq.pan_reg = pan_reg;
    Object.values(this.components.acquisition).forEach((val) => {
      th.panels.daq.pan_reg.addComponent(val);
    });
    //--------------------------------------LOGBOOK PANEL--------------------------------------//
    let pan_logbook = new Panel("panel_logbook", "Logbook");
    this.panels.daq.pan_logbook = pan_logbook;
    Object.values(this.components.logbook).forEach((val) => {
      th.panels.daq.pan_logbook.addComponent(val);
    });

    //CALIBRATION PAGE(S)
    if (this.hasPos) {
      //--------------------------------------POSITION CALIBRATION MANAGER PANEL
      let pan_managePosCalib = new Panel(
        "panel_manage_posCalibration",
        "Calibration"
      );
      this.panels.posCalib.pan_managePosCalib = pan_managePosCalib;
      Object.values(this.components.managePosCalib).forEach((val) => {
        th.panels.posCalib.pan_managePosCalib.addComponent(val);
      });
    }
    if (this.hasRng) {
      //--------------------------------------RANGE CALIBRATION MANAGER PANEL
      let pan_manageRngCalib = new Panel(
        "panel_manage_rngCalibration",
        "Calibration"
      );
      this.panels.rngCalib.pan_manageRngCalib = pan_manageRngCalib;
      Object.values(this.components.manageRngCalib).forEach((val) => {
        th.panels.rngCalib.pan_manageRngCalib.addComponent(val);
      });
    }
  }

  fillErrorModal() {
    this.modal.setTitle("Internal Errors / Warnings");
    this.modal.setBody(
      $("<table>", { class: "table" })
        .append(
          $("<thead>").append(
            $("<tr>")
              .append($("<th>", { scope: "col", html: "Timestamp" }))
              .append($("<th>", { scope: "col", html: "Message" }))
          )
        )
        .append($("<tbody>", { id: "errorList" }))
        .append(
          "<p>Click the RESET ALARMS button to reset errors and warnings. If the problem is not solved, contact the manufacturer.</p>"
        )
    );
    this.errorList.forEach(function (error, index) {
      $("#errorList").append(
        $("<tr>", { class: error.type == 0 ? "table-warning" : "table-danger" })
          .append($("<td>", { html: error.time.toLocaleString() }))
          .append($("<td>", { html: error.message }))
      );
    });
    this.modal.addButton("btn_close", "secondary", "Close", true);
  }

  fillDAQModal() {
    let th = this;
    //--------------------------------SAVE/DISCARD MODAL--------------------------------//
    this.modal.setTitle("Save / Discard Run");
    this.modal.setBody(
      '<div class="input-group">\n' +
        '  <div class="input-group-prepend">\n' +
        '    <span class="input-group-text">Notes</span>\n' +
        "  </div>\n" +
        '  <textarea id="notes" class="form-control" aria-label="With textarea"></textarea>\n' +
        "</div>"
    );
    //Delete button
    this.modal.addButton("btn_delete", "danger", "Discard", false, function () {
      let cluster = {
        file_list: [],
      };
      th.ws.send("delete_file", JSON.stringify(cluster));
      th.modal.hide();
    });
    //Save button
    this.modal.addButton("btn_save", "success", "Save", false, function () {
      let get_html = $("#notes").val();
      let error_string = "";
      th.errorList.forEach(function (error, index) {
        error_string = error_string.concat(error.time.toLocaleString() + "  ");
        if (error.type == "0") {
          error_string = error_string.concat("WARNING: ");
        }
        if (error.type == "1") {
          error_string = error_string.concat("ERROR: ");
        }
        error_string = error_string.concat(error.message + "\n");
      });
      let notes_cluster = {
        notes: get_html,
        errors: error_string,
      };
      th.ws.send("save_notes", JSON.stringify(notes_cluster));
      th.modal.hide();
    });
  }

  fillLogbookCalibrationModal(mode) {
    let th = this;
    let calibList = null;
    let suffix = "";
    switch (mode) {
      case "posCalib":
        calibList = this.filesList.posCalibFiles;
        suffix = ".XYcalib";
        break;
      case "rngCalib":
        calibList = this.filesList.posCalibFiles;
        suffix = ".Zcalib";
        break;
      default:
        console.log("Case not recognized");
        break;
    }
    this.modal.setTitle("Calibration files list");
    this.modal.setBody(
      $("<table>", { class: "table" })
        .append(
          $("<thead>").append(
            $("<tr>")
              .append($("<th>", { scope: "col", width: "20%", html: "#" }))
              .append($("<th>", { scope: "col", width: "80%", html: "Name" }))
          )
        )
        .append($("<tbody>", { id: "calibsList" }))
    );
    if (calibList.length > 0) {
      calibList.forEach(function (calfile, index) {
        $("#calibsList").append(
          $("<tr>", { class: "" })
            .append($("<th>", { scope: "row", html: index }))
            .append($("<td>", { html: calfile }))
        );
      });
      // Select row behavior
      Util.attachEvent("#calibsList tr", "click", function (ref) {
        $(ref).addClass("selected").siblings().removeClass("selected");
        let get_html = $("#calibsList tr.selected td:first").html();
        if ($("#download_titles").length) $("#download_titles").remove();
        if ($("#download_links_row").length) $("#download_links_row").remove();
        $("#calibsList")
          .append(
            $("<tr>", { id: "download_titles" })
              .append($("<th>", { scope: "col", html: " " }))
              .append(
                $("<th>", { scope: "col", html: "DOWNLOAD Calibration file" })
              )
          )
          .append(
            $("<tr>", { class: "download_links", id: "download_links_row" })
              .append(
                $("<td>", { scope: "row", class: "align-middle" }).append(
                  $("<span>", { scope: "row", html: " " })
                )
              )
              .append(
                $("<td>", { scope: "row", class: "align-middle" }).append(
                  $("<div>", { class: "btn-success" }).append(
                    $("<a>", {
                      id: "link_calib",
                      href: th.calibBaseURL + get_html + suffix,
                      target: "_blank",
                      download: get_html + suffix,
                      html: "Calibration",
                    })
                  )
                )
              )
          );
      });
    } else {
      $("#calibsList").append(
        '<p style="padding: 10px;">No available files</p>'
      );
    }
    // DELETE FILE
    this.modal.addButton("btn_delete", "danger", "Delete", false, function () {
      let get_html = $("#calibsList tr.selected td:first").html();
      if (!Util.isDefined(get_html)) return;
      alertify.confirm(
        "Delete?",
        "Are you sure to delete this calibration file?",
        function () {
          if (mode == "posCalib") {
            th.ws.send_to_logger("log_delete_profile_calib_file", get_html);
          }
          if (mode == "rngCalib") {
            th.ws.send_to_logger("log_delete_range_calib_file", get_html);
          }
          th.modal.hide();
        },
        function () {
          alertify.error("Cancelled", 2);
          return;
        }
      );
    });
    // LOAD FILE
    this.modal.addButton("btn_load", "success", "Load", false, function () {
      let get_html = $("#calibsList tr.selected td:first").html();
      if (!Util.isDefined(get_html)) return;
      if (mode == "posCalib") {
        th.ws.send_to_logger("log_load_profile_calib_file", get_html);
      }
      if (mode == "rngCalib") {
        th.ws.send_to_logger("log_load_range_calib_file", get_html);
      }
      th.modal.hide();
    });
    // DISMISS MODAL
    this.modal.addButton("btn_close", "secondary", "Close", true);
  }

  fillSaveCalibrationModal(mode) {
    let th = this;
    this.modal.setTitle("Save Calibration");
    this.modal.setBody(
      '<div class="input-group">\n' +
        '  <div class="input-group-prepend">\n' +
        '    <span class="input-group-text">File name</span>\n' +
        "  </div>\n" +
        '  <textarea id="calib_name" class="form-control" aria-label="With textarea"></textarea>\n' +
        "</div>"
    );
    this.modal.addButton("btn_save", "success", "Save", false, function () {
      let get_html = $("#calib_name").val().split(" ").join("_");
      let calib_factors = {};
      let files = [];
      if (mode == "pos") {
        files = th.posCalibFiles;
      }
      if (mode == "rng") {
        files = th.rngCalibFiles;
      }
      if (files.includes(get_html)) {
        alertify.confirm(
          "Overwrite?",
          "A calibration file with the same name is already in memory. Proceed saving and overwrite the current file?",
          function () {
            if (mode == "pos") {
              th.calibFields.posXchannels.map(
                (x, idx) =>
                  (calib_factors["posXchannels"][idx] = !isNaN(
                    validateNumInput(x.getId(true))
                  )
                    ? validateNumInput(x.getId(true))
                    : 1)
              );
              th.calibFields.posYchannels.map(
                (y, idx) =>
                  (calib_factors["posYchannels"][idx] = !isNaN(
                    validateNumInput(y.getId(true))
                  )
                    ? validateNumInput(y.getId(true))
                    : 1)
              );
              th.calibFields.intChannels.map(
                (int, idx) =>
                  (calib_factors["intChannels"][idx] = !isNaN(
                    validateNumInput(int.getId(true))
                  )
                    ? validateNumInput(int.getId(true))
                    : 1)
              );
              calib_factors["intChannels"].map((i, idx) => {
                th.calib_param["Int" + (idx + 1) + "_calib"] = i;
              });
              th.calib_param.X_calib = calib_factors["posXchannels"];
              th.calib_param.Y_calib = calib_factors["posYchannels"];
              th.calib_param.filename = get_html;
              th.ws.send_to_logger(
                "log_save_profile_calibration",
                JSON.stringify(th.calib_param)
              );
            }
            if (mode == "rng") {
              th.calibFields.rngChannels.map(
                (x, idx) =>
                  (calib_factors["rngChannels"][idx] = !isNaN(
                    validateNumInput(x.getId(true))
                  )
                    ? validateNumInput(x.getId(true))
                    : 1)
              );
              th.calib_param.filename_Z = get_html;
              th.calib_param.Z_calib = calib_factors["rngChannels"];
              th.ws.send_to_logger(
                "log_save_range_calibration",
                JSON.stringify(th.calib_param)
              );
            }
            th.modal.hide();
          },
          function () {
            alertify.error("Change file name", 2);
            return;
          }
        );
      } else {
        if (mode == "pos") {
          th.calibFields.posXchannels.map(
            (x, idx) =>
              (calib_factors["posXchannels"][idx] = !isNaN(
                validateNumInput(x.getId(true))
              )
                ? validateNumInput(x.getId(true))
                : 1)
          );
          th.calibFields.posYchannels.map(
            (y, idx) =>
              (calib_factors["posYchannels"][idx] = !isNaN(
                validateNumInput(y.getId(true))
              )
                ? validateNumInput(y.getId(true))
                : 1)
          );
          th.calibFields.intChannels.map(
            (int, idx) =>
              (calib_factors["intChannels"][idx] = !isNaN(
                validateNumInput(int.getId(true))
              )
                ? validateNumInput(int.getId(true))
                : 1)
          );
          calib_factors["intChannels"].map((i, idx) => {
            th.calib_param["Int" + (idx + 1) + "_calib"] = i;
          });
          th.calib_param.X_calib = calib_factors["posXchannels"];
          th.calib_param.Y_calib = calib_factors["posYchannels"];
          th.calib_param.filename = get_html;
          th.ws.send_to_logger(
            "log_save_profile_calibration",
            JSON.stringify(th.calib_param)
          );
        }
        if (mode == "rng") {
          th.calibFields.rngChannels.map(
            (x, idx) =>
              (calib_factors["rngChannels"][idx] = !isNaN(
                validateNumInput(x.getId(true))
              )
                ? validateNumInput(x.getId(true))
                : 1)
          );
          th.calib_param.filename_Z = get_html;
          th.calib_param.Z_calib = calib_factors["rngChannels"];
          th.ws.send_to_logger(
            "log_save_range_calibration",
            JSON.stringify(th.calib_param)
          );
        }
        th.modal.hide();
      }
    });
    this.modal.addButton("btn_close", "secondary", "Close", true);
  }

  fillSaveBackgroundModal(data) {
    let th = this;
    this.modal.setTitle("Save / Discard Background Run");
    this.modal.setBody(
      '<div class="input-group">\n' +
        '  <div class="input-group-prepend">\n' +
        '    <span class="input-group-text">Filename</span>\n' +
        "  </div>\n" +
        '  <textarea id="bkg_filename" class="form-control" aria-label="With textarea"></textarea>\n' +
        "</div>"
    );
    //Delete button
    this.modal.addButton("btn_delete", "danger", "Discard", false, function () {
      let cluster = {
        filename: data,
      };
      th.ws.send_to_logger("log_delete_background", JSON.stringify(cluster));
      th.modal.hide();
    });
    //Save button
    this.modal.addButton("btn_save", "success", "Save", false, function () {
      let flag = false;
      let get_html = $("#bkg_filename").val();
      th.filesList.backgroundFiles.map((x) => {
        let check_string = x; //.substring(0, th.calib_filelist[ck].length - 6);
        if (get_html == check_string) {
          flag = true;
        }
      });
      let bkg_cluster = {
        old_name: data,
        new_name: get_html,
      };
      if (flag) {
        alertify.confirm(
          "Overwrite?",
          "A background file with the same name is already in memory. Proceed saving and overwrite the current file?",
          function () {
            th.ws.send_to_logger(
              "log_rename_background",
              JSON.stringify(bkg_cluster)
            );
            th.modal.hide();
          },
          function () {
            alertify.error("Change file name", 2);
            return;
          }
        );
      } else {
        th.ws.send_to_logger(
          "log_rename_background",
          JSON.stringify(bkg_cluster)
        );
        th.modal.hide();
      }
    });
  }

  fillLogbookBackgroundModal() {
    let th = this;
    let bkgList = this.filesList.backgroundFiles;
    this.modal.setTitle("Background files list");
    this.modal.setBody(
      $("<table>", { class: "table" })
        .append(
          $("<thead>").append(
            $("<tr>")
              .append($("<th>", { scope: "col", width: "20%", html: "#" }))
              .append($("<th>", { scope: "col", width: "80%", html: "Name" }))
          )
        )
        .append($("<tbody>", { id: "bkgList" }))
    );
    if (bkgList.length > 0) {
      bkgList.forEach(function (file, index) {
        $("#bkgList").append(
          $("<tr>", { class: "" })
            .append($("<th>", { scope: "row", html: index }))
            .append($("<td>", { html: file }))
        );
      });
      // Select row behavior
      Util.attachEvent("#bkgList tr", "click", function (ref) {
        $(ref).addClass("selected").siblings().removeClass("selected");
        let get_html = $("#bkgList tr.selected td:first").html();
      });
    } else {
      $("#bkgList").append('<p style="padding: 10px;">No available files</p>');
    }
    // DELETE FILE
    this.modal.addButton("btn_delete", "danger", "Delete", false, function () {
      let get_html = $("#bkgList tr.selected td:first").html();
      if (!Util.isDefined(get_html)) {
        alertify.warning("No file selected", 2);
        return;
      }
      let file_to_delete = {
        filename: get_html,
      };
      alertify.confirm(
        "Delete?",
        "Are you sure to delete this background file?",
        function () {
          th.ws.send_to_logger("log_delete_background", get_html);
          th.modal.hide();
        },
        function () {
          alertify.error("Cancelled", 2);
          return;
        }
      );
    });
    // DOWNLOAD FILES
    this.modal.addButton(
      "btn_download",
      "success",
      "Download",
      false,
      function () {
        let get_html = $("#bkgList tr.selected td:first").html();
        if (!Util.isDefined(get_html)) {
          alertify.warning("No file selected", 2);
          return;
        }
        let cluster = {
          file_list: [get_html],
          include: "false",
          IP_addr: th.detConfig.ws_address,
        };
        alertify.confirm(
          "Download?",
          "Are you sure to download this background run?",
          function () {
            th.ws.send_to_logger(
              "log_download_background",
              JSON.stringify(cluster)
            );
            th.modal.hide();
          },
          function () {
            alertify.error("Cancelled", 2);
            return;
          }
        );
      }
    );
    // DISMISS MODAL
    this.modal.addButton("btn_close", "secondary", "Close", true);
  }

  resetAllPlots() {
    this.graph_array.map((x) => x.reset());
  }

  toggleDaq() {
    let th = this;
    if (this.ws.isConnected()) {
      if (this.controlUnitStatus != 0 && this.controlUnitStatus != 99) {
        alertify.error("Internal error! CLEAR ALARMS and try again");
        return;
      }
      if (this.daqStatus == 2) {
        //data streaming running
        alertify.warning(
          "Data streaming ongoing. Stop data streaming before starting an acquisition!"
        );
        return;
      }
      // Check if measure is running
      if (this.daqStatus == 1) {
        // MEASURE RUNNING -> stop command
        this.stopDAQ();
      } else if (this.daqStatus == 3) {
        //aQuracy with automatic DAQ stop
        alertify.warning(
          "Wait! DAQ will stop automatically at the end of acquisition",
          2
        );
      } else {
        // MEASURE NOT RUNNING -> start command
        if (this.HVStatus == 0) {
          //HV off case
          alertify.confirm(
            "HV off or out of range",
            "HV is off or out of range. Are you sure to start DAQ?",
            function () {
              th.startDAQ();
            },
            function () {
              alertify.error("Aborted", 2);
              return;
            }
          );
        } else {
          //HV on case
          this.startDAQ();
        }
      }
    } else {
      conn_error();
    }
  }

  toggleDataStream() {
    let th = this;
    if (this.ws.isConnected()) {
      if (this.controlUnitStatus != 0) {
        alertify.error("Internal error! CLEAR ALARMS and try again");
        return;
      }
      if (this.daqStatus == 1 || this.daqStatus == 4) {
        alertify.warning(
          "DAQ ongoing. Stop DAQ before starting data streaming!"
        );
        return;
      }
      // Check if streaming is running
      if (this.daqStatus == 2) {
        // streaming running -> stop command
        this.stopDataStream();
      } else {
        if (this.HVStatus == 0) {
          //HV off case
          alertify.confirm(
            "HV off or out of range",
            "HV is off or out of range. Are you sure to start data streaming?",
            function () {
              th.startDataStream();
            },
            function () {
              alertify.error("Aborted", 2);
              return;
            }
          );
        } else {
          this.startDataStream();
        }
      }
    } else {
      conn_error();
    }
  }

  stopDAQ(auto = false) {
    if (!auto) {
      this.ws.send("measure_stop");
    }
    this.configs_array.map((x) => {
      x.enable();
    });
    if ($(this.components.settings.samplMode.getId(true)).val() != "0") {
      this.components.settings.samplRate.disable();
    } else {
      this.components.settings.samplRate.enable();
    }
    this.setDaqStatus(0);
    this.graph_array.map((x) => {
      x.enable_tooltips();
    });
    this.components.acquisition.loader.deactivate();
    $("#btn_acq").removeClass("btn-danger").addClass("btn-success");
    $("#measurePlaySpan").removeClass("mdi-stop").addClass("mdi-play");
    this.fillDAQModal();
    this.modal.show();
  }

  startDAQ() {
    alertify.success("DAQ starting...", 2);
    let date_acq = new Date();
    this.settings.datetime = formatDate(date_acq); //updating the run timestamp
    this.ws.send("measure_start", JSON.stringify(this.settings));
    this.setDaqStatus(this.devName == "aQuracy" ? 3 : 1);
    console.log("Updated DAQ status -> " + this.daqStatus);
    this.configs_array.map((x) => {
      x.disable();
    });
    this.graph_array.map((x) => {
      x.reset();
      x.disable_tooltips();
    });
    $("#btn_acq").removeClass("btn-success").addClass("btn-danger");
    $("#measurePlaySpan").removeClass("mdi-play").addClass("mdi-stop");
    this.components.acquisition.loader.activate();
  }

  stopDataStream() {
    this.ws.send("stop_data_stream");
    this.configs_array.map((x) => {
      x.enable();
    });
    if ($(this.components.settings.samplMode.getId(true)).val() != "0") {
      this.components.settings.samplRate.disable();
    } else {
      this.components.settings.samplRate.enable();
    }
    this.setDaqStatus(0);
    this.graph_array.map((x) => {
      x.enable_tooltips();
    });
    this.components.acquisition.loader.deactivate();
    this.components.acquisition.btnDataStream.setName("Start data stream");
    $("#btn_data_stream")
      .removeClass("btn-outline-danger")
      .addClass("btn-outline-success");
  }

  startDataStream() {
    alertify.success("Data stream starting...", 2);
    this.ws.send("start_data_stream", JSON.stringify(this.settings));
    this.setDaqStatus(2);
    this.configs_array.map((x) => x.disable());
    this.graph_array.map((x) => {
      x.disable_tooltips();
      x.reset();
    });
    this.components.acquisition.btnDataStream.setName("Stop data stream");
    $("#btn_data_stream")
      .removeClass("btn-outline-success")
      .addClass("btn-outline-danger");
    this.components.acquisition.loader.activate();
  }

  recordBackground() {
    let th = this;
    if (this.ws.isConnected()) {
      if (this.controlUnitStatus != 0 && this.controlUnitStatus != 99) {
        alertify.error("Internal error! CLEAR ALARMS and try again");
        return;
      }
      if (this.daqStatus == 2) {
        alertify.warning(
          "Data streaming ongoing. Stop data streaming before starting a background acquisition!"
        );
        return;
      }
      if (this.daqStatus == 1) {
        alertify.warning(
          "DAQ ongoing. Stop DAQ before starting a background acquisition!"
        );
        return;
      }
      // Check if background acquisition is running
      if (this.daqStatus == 4) {
        alertify.warning(
          "Background acquisition ongoing. It will stop automatically!"
        );
        return;
      }
      if (this.HVStatus == 0) {
        //HV off case
        alertify.confirm(
          "HV off or out of range",
          "HV is off or out of range. Are you sure to start background DAQ?",
          function () {
            th.startRecordBackground();
          },
          function () {
            alertify.error("Aborted", 2);
            return;
          }
        );
      } else {
        //HV on case
        th.startRecordBackground();
      }
    } else {
      console.log("WebSocket is not connected!");
      conn_error();
    }
  }

  startRecordBackground() {
    alertify.success("Background DAQ starting...", 2);
    this.send("bkg_measure_start", JSON.stringify(this.bkg_settings));
    this.setDaqStatus(4);
    this.configs_array.map((x) => x.disable());
    this.graph_array.map((x) => {
      x.disable_tooltips();
      x.reset();
    });
    this.components.background.btnBkgDaq.setName("Recording background ...");
    $("#btn_bkg_acq")
      .removeClass("btn-outline-success")
      .addClass("btn-outline-danger");
    this.components.acquisition.loader.activate();
  }

  stopRecordBackground(data) {
    this.configs_array.map((x) => x.enable());
    if ($(this.components.settings.samplMode.getId(true)).val() != "0") {
      this.components.settings.samplRate.disable();
    } else {
      this.components.settings.samplRate.enable();
    }
    this.setDaqStatus(0);
    this.graph_array.map((x) => {
      x.enable_tooltips();
    });
    this.components.acquisition.loader.deactivate();
    this.components.acquisition.btnBkgDaq.setName("Record background");
    $("#btn_bkg_acq")
      .removeClass("btn-outline-danger")
      .addClass("btn-outline-success");
    this.fillSaveBackgroundModal(data);
    this.modal.show();
  }

  getPanels(page) {
    let panels = {};
    for (const [key, value] of Object.entries(this.panels.shared)) {
      panels[key] = value;
    }
    switch (page) {
      case "daq":
        for (const [key, value] of Object.entries(this.panels["daq"])) {
          panels[key] = value;
        }
        break;
      case "posCalib":
        for (const [key, value] of Object.entries(this.panels["posCalib"])) {
          panels[key] = value;
        }
        break;
      case "rngCalib":
        for (const [key, value] of Object.entries(this.panels["rngCalib"])) {
          panels[key] = value;
        }
        break;
      default:
        console.log("No panel to add");
    }
    return panels;
  }

  getErrorList() {
    return this.errorList;
  }

  getModal() {
    return this.modal;
  }

  getDaqStatus() {
    return this.daqStatus;
  }

  setDaqStatus(val) {
    this.daqStatus = parseInt(val);
  }

  setMemoryStatus(data) {
    this.components.status.memory_ind.updateData(data);
  }

  getControlUnitStatus() {
    return this.controlUnitStatus;
  }

  setControlUnitStatus(val) {
    this.controlUnitStatus = parseInt(val);
    this.components.status.cuStatus_ind.update(this.controlUnitStatus);
  }

  getHVStatus() {
    return this.hvStatus;
  }

  setHVStatus(val) {
    this.hvStatus = parseInt(JSON.parse(val).type);
    this.components.status.hvStatus_ind.updateHV(val);
  }

  updateErrorList(data) {
    let error = {
      type: data.type,
      message: data.value,
      time: new Date(),
    };
    let delta_time = 0;
    let flag_push = true;
    let errN = this.errorList.length;
    if (errN != 0) {
      if (error.message != this.errorList[errN - 1].message) {
        flag_push = true;
        notifyError(error);
      } else {
        delta_time = getDeltaDate(
          errorList[errorList.length - 1].time,
          error.time
        );
        if (delta_time > 8) {
          flag_push = true;
          notifyError(error);
        } else {
          flag_push = false;
        }
      }
    } else {
      notifyError(error);
    }
    if (error.type == "99") {
      //WARNING CASE
      if (flag_push) {
        this.errorList.push(error);
      }
    } else {
      if (flag_push) {
        this.errorList.push(error);
        Util.notify(
          "",
          "INTERNAL ERROR! " +
            error.message +
            " DATA STREAM AUTOMATICALLY STOPPED",
          "e",
          0
        );
      }
      this.setControlUnitStatus(error.type);
      this.setDaqStatus(0);
      switch (this.daqStatus) {
        case 1:
          this.ws.send("measure_stop");
          $(this.components.acquisition.btnDAQ.getId(true))
            .removeClass("btn-danger")
            .addClass("btn-success");
          $("#measurePlaySpan").removeClass("mdi-stop").addClass("mdi-play");
          let error_string_stop = ""; // registering error list for notes file
          this.errorList.map((error) => {
            error_string_stop = error_string_stop.concat(
              error.time.toLocaleString() + " "
            );
            if (error.type == "99") {
              error_string_stop = error_string_stop.concat("WARNING: ");
            } else {
              error_string_stop = error_string_stop.concat("ERROR: ");
            }
            error_string_stop = error_string_stop.concat(error.message + "\n");
          });
          let notes_string = "RUN STOPPED BY INTERNAL ERROR: ".concat(
            error.message
          );
          let error_cluster_stop = {
            notes: notes_string,
            errors: error_string_stop,
          };
          this.ws.send_to_logger(
            "log_save_notes",
            JSON.stringify(error_cluster_stop)
          );
          break;
        case 2:
          this.ws.send("stop_data_stream");
          $(this.components.acquisition.btnDataStream.getId(true))
            .removeClass("btn-outline-danger")
            .addClass("btn-outline-success");
          $(this.components.acquisition.btnDataStream.getId(true)).html(
            "Start data stream"
          );
          break;
        case 4:
          this.ws.send("measure_stop");
          $(this.components.acquisition.btnBkgDaq.getId(true))
            .removeClass("btn-outline-danger")
            .addClass("btn-outline-success");
          $(this.components.acquisition.btnBkgDaq.getId(true)).html(
            "Record background"
          );
          break;
        default:
          break;
      }
      this.configs_array.map((x) => x.enable());
      if ($(this.components.settings.samplMode.getId(true)).val() != "0") {
        this.components.settings.samplRate.disable();
      } else {
        this.components.settings.samplRate.enable();
      }
      this.graph_array.map((x) => x.enable_tooltips());
      this.components.acquisition.loader.deactivate();
    }
  }

  updateCalibFileList(data, mode) {
    let unpacked = JSON.parse(data);
    let recList = unpacked.list;
    if (recList.length >= 0) {
      switch (mode) {
        case "posCalib":
          this.filesList.posCalibFiles = recList;
          break;
        case "rngCalib":
          this.filesList.rngCalibFiles = recList;
          break;
        default:
          console.log("Case not recognized");
          break;
      }
    } else {
      Util.log("Calibration files list not defined", 1);
    }
    return recList;
  }

  updateCalibController(mode) {
    switch (mode) {
      case "posCalib":
        this.components.calibration.select_pos_calib.update(
          JSON.stringify({ list: this.filesList.posCalibFiles })
        );
        break;
      case "rngCalib":
        this.components.calibration.select_rng_calib.update(
          JSON.stringify({ list: this.filesList.rngCalibFiles })
        );
        break;
      default:
        console.log("Case not recognized");
        break;
    }
  }

  updateBackgroundFileList(data) {
    let unpacked = JSON.parse(data);
    let recList = unpacked.list;
    if (recList.length >= 0) {
      this.filesList.backgroundFiles = recList;
    } else {
      Util.log("Background files list not defined", 1);
    }
    return recList;
  }

  updateBackgroundController() {
    this.components.background.select_bkg.update(
      JSON.stringify({ list: this.filesList.backgroundFiles })
    );
  }

  updateDataFileList(data, mode) {
    let unpacked = JSON.parse(data);
    let run_list = unpacked.run_list;
    let notes_list = unpacked.notes_list;
    let measuresList = [];
    if (run_list.length >= 0) {
      let dt = { name: "", notes: "" };
      run_list.forEach(function (value, index) {
        dt = { name: "", notes: "" };
        dt.name = value;
        dt.notes = notes_list[index];
        measuresList.push({ name: value, notes: notes_list[index] });
      });
      switch (mode) {
        case "posData":
          this.filesList.posDataFiles = measuresList;
          break;
        case "rngData":
          this.filesList.rngDataFiles = measuresList;
          break;
        default:
          console.log("Case not recognized");
          break;
      }
    }
    return measuresList;
  }

  updateSamplingMode(data) {
    this.components.settings.samplMode.updateSM(data);
  }

  updateSamplingRate(data) {
    this.components.settings.samplRate.updateSR(data);
  }

  loadCalibFile(data, mode) {
    let th = this;
    let recData = JSON.parse(data);
    if (mode == "rngCalib") {
      recData.Z_calib.map((x, idx) => {
        th.calibFields.rngChannels[idx].update(x);
      });
    }
    if (mode == "posCalib") {
      recData.X_calib.map((x, idx) => {
        th.calibFields.posXchannels[idx].update(x);
      });
      recData.Y_calib.map((x, idx) => {
        th.calibFields.posYchannels[idx].update(x);
      });
      th.calibFields.intChannels[0].update(recData.Int1_calib);
      th.calibFields.intChannels[1].update(recData.Int2_calib);
    }
  }

  uploadCalibFile(input, mode) {
    let th = this;
    let filename = input.val().replace(/\\/g, "/").replace(/.*\//, "");
    let inputEl = null;
    let fileInput = null;
    let textBox = null;
    if (mode == "posCalib") {
      inputEl = this.components.managePosCalib.form_upload_file;
      fileInput = document.getElementById(inputEl.getId() + "_input");
      textBox = this.components.managePosCalib.uploaded_file;
    }
    if (mode == "rngCalib") {
      inputEl = this.components.manageRngCalib.form_upload_file;
      fileInput = document.getElementById(inputEl.getId() + "_input");
      textBox = this.components.manageRngCalib.uploaded_file;
    }
    let file = fileInput.files[0];
    let reader = new FileReader();
    reader.onload = (e) => th.validateLoadCalibUpload(e.target.result, mode);
    reader.onerror = (e) => alertify.error("Error uploading the file", 2);
    reader.readAsBinaryString(file);
  }

  validateCalibUpload(content, mode) {
    let temp = [];
    let data = {
      X_calib: [],
      Y_calib: [],
      Z_calib: [],
      Int1_calib: 1,
      Int2_calib: 1,
    };
    // let content = e.target.result;
    let array_lines = content.split("\n");
    array_lines = array_lines.filter((line) => line); // removing all falsy values from lines array -> this removes the empty lines at the end of the file
    console.log(array_lines);
    if (mode == "rngCalib") {
      if (array_lines.length != this.detConfig.nChZ + 1) {
        alertify.warning("Unrecognized file format");
        return;
      } else {
        array_lines.map((x, idx) => {
          if (idx > 0) {
            temp = x.split("\t");
            data.Z_calib.push(parseFloat(temp[1]));
          }
        });
      }
    }
    if (mode == "posCalib") {
      if (
        array_lines.length != this.detConfig.nChX + 1 ||
        array_lines.length != this.detConfig.nChY + 1
      ) {
        console.log(array_lines);
        alertify.warning("Unrecognized file format");
        return;
      } else {
        array_lines.map((x, idx) => {
          if (idx > 0) {
            temp = x.split("\t");
            data.X_calib.push(parseFloat(temp[1]));
            data.Y_calib.push(parseFloat(temp[2]));
            if (temp[3]) {
              if (idx == 1) data.Int1_calib = parseFloat(temp[3]);
              if (idx == 2) data.Int2_calib = parseFloat(temp[3]);
            }
          }
        });
      }
    }
    return data;
  }

  validateLoadCalibUpload(content, mode) {
    let data = this.validateCalibUpload(content, mode);
    this.loadCalibFile(JSON.stringify(data), mode);
  }

  disconnect() {
    if (this.daqStatus == 1) {
      alertify.error(
        "DAQ aborted by unexpected disconnection! The device will try to save the acquired data with comment <<Run aborted by unexpected client disconnection. CHECK THE DATA>>."
      );
      $("#btn_acq").removeClass("btn-danger").addClass("btn-success");
      $("#measurePlaySpan").removeClass("mdi-stop").addClass("mdi-play");
    }
    if (this.daqStatus == 2) {
      alertify.error("Data streaming aborted by unexpected disconnection!");
      Util.trig("btn_data_stream", "setName", "Start data stream");
      $("#btn_data_stream")
        .removeClass("btn-outline-danger")
        .addClass("btn-outline-success");
    }
    this.graph_array.map((x) => x.enable_tooltips());
    this.setDaqStatus(0);
    this.setControlUnitStatus(99);
    if (this.hasHV) this.setHVStatus(99);
    if (this.devName == "aQuracy") this.setCameraStatus(99);
  }
}

export default Sidebar;
