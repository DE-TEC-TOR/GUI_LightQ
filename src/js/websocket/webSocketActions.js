/**
 *
 *  Contains the all the actions connected to the webSocket functionalities
 *
 * @author : Mattia Fontana
 * @company : TORETDevices srl
 * @version : 1.0.0
 *
 */

import Util from '../core/Util';

let actions = {};

//---------------------------- DEVICE STATUS UPDATE ACTIONS ----------------------------//
actions.connected = (sidebar, val) => {
    sidebar.setControlUnitStatus(val);
}

actions.updateDeviceStatus = (sidebar, val) => {
    let present_status = sidebar.getControlUnitStatus();
    if (present_status != 1) {
        sidebar.setControlUnitStatus(val);
    } // if it is 1, we have an error in memory -> we must clear the alarms before
}

actions.updateMemoryStatus = (sidebar, data) => {
    sidebar.setMemoryStatus(data);
}

actions.updateHVStatus = (sidebar, val) => {
    sidebar.setHVStatus(val);
}

actions.updateCameraStatus = (sidebar, val) => {
    sidebar.setCameraStatus(val);
}

actions.updateErrorList = (sidebar, error) => {
    sidebar.updateErrorList(error);
}
//----------------------------------------------------------------------------------- //
//---------------------------- DEVICE SETTINGS/CONTROLS ACTIONS ----------------------------//
actions.saveBackground = (sidebar, data) => {
    sidebar.stopRecordBackground(data);
}

actions.updateSamplingMode = (sidebar, data) => {
    sidebar.updateSamplingMode(data);
}

actions.updateSamplingRate = (sidebar, data) => {
    sidebar.updateSamplingRate(data);
}

actions.updateDaqTrigger = (sidebar, data) => {
    sidebar.updateDaqTrigger(data);
}

actions.updateFirstChannel = (sidebar, data) => {
    sidebar.updateFirstChannel(data);
}

actions.updateExposure = (sidebar, data) => {
    sidebar.updateCamExposure(data);
}

actions.updateDaqTotalTime = (sidebar, data) => {
    sidebar.updateDaqTotTime(data);
}

actions.resetAllPlots = (sidebar) => {
    sidebar.resetAllPlots();
}

actions.updateRunList = (sidebar, data, mode) => {
    let fileList = sidebar.updateDataFileList(data, mode);
    if(fileList.length > 0){
        sidebar.fillLogbookDataModal(mode);
        sidebar.getModal().show();
    }
    else
    {
        Util.log('Measures list not defined', 1);
    }
}

actions.updateCalibList = (sidebar, data, mode, status = 'hidden') => {
    let list = sidebar.updateCalibFileList(data, mode);
    if(status == 'init') sidebar.updateCalibController(mode);
    if(status == 'modal'){
        if(list.length > 0){
            sidebar.fillLogbookCalibrationModal(mode);
            sidebar.getModal().show();
        }
        else{
            alertify.warning('No calibration files available', 2);
        }
    }
}

actions.updateBackgroundList = (sidebar, data, status = 'hidden') => {
    let list = sidebar.updateBackgroundFileList(data);
    if(status == 'init') sidebar.updateBackgroundController();
    if(status == 'modal'){
        if(list.length > 0){
            sidebar.fillLogbookBackgroundModal();
            sidebar.getModal().show();
        }
        else{
            alertify.warning('No background files available', 2);
        }
    }
}

actions.loadCalibFile = (sidebar, data, mode) => {
    sidebar.loadCalibFile(data, mode);
}

actions.autoStopDaq = (sidebar) => {
    sidebar.stopDAQ(true);
}

actions.warning = (sidebar, data) => {
    let warning_toGUI = {
        'type': 99,
        'value': JSON.parse(data).warning,
        'code': JSON.parse(data).code
    };
    sidebar.updateErrorList(warning_toGUI);
}

actions.error = (sidebar, data) => {
    let error_cl = JSON.parse(data);
    let error_toGUI = null;
    error_str = null;
    if ('type' in error_cl && 'error' in error_cl) {
        if (error_cl.type == 0) {error_str = 'CONNECTION ERROR: \n';}
        else if (error_cl.type == 1) {error_str = 'INTERNAL ERROR: \n';}
        else if (error_cl.type == 2) {error_str = 'ANALYSIS ERROR: \n';}
        else {error_str = 'GENERIC ERROR: \n'}
        JSON.parse(data).error.forEach(function (val, idx) {
            error_str += val + '\n';
        })
        if(error_cl.type == 2){
            alertify.error(error_str, 2);
        }
        else{
            error_toGUI = {
                'type': error_cl.type,
                'value': error_str,
                'code': error_cl.code
            };
            sidebar.updateErrorList(error_toGUI);
        }
        return;
    }
    else{
        alertify.error('GENERIC ERROR', 2);
    }
}
//----------------------------------------------------------------------------------- //
//---------------------------- GRAPHICS ACTIONS ----------------------------//
actions.updateProfiles = (section, axis, mode = 'int', data) => {
    section.updateProfiles(axis, mode, data);
}

actions.updateIntegrals = (section, name, mode, data) => {
    section.updateIntegrals(name, mode, data);
}

actions.loadIntData = (section, name, mode, data) => {
    section.loadIntegrals(name, mode, data);
}

actions.load2Dimage = (section, data) => {
    section.load2Dimage(data);
}


export default actions;
