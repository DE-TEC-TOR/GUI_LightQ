/**
 *  Helper/utils functions
 *
 *
 * @author : MattF
 * @company : DE.TEC.TOR. srl
 * @version : 1.0.0
 */
//---------------------------------------------PRODUCT/SOFTWARE VERSION----------------------------------//
export function createVersionObject(devName, devID, rev) {
  return {
    prod: "De.Tec.Tor. srl",
    rel: "v1.0.0",
    date: "03/2020",
    product: devName,
    manual: "QCM" + devID + "-R&D-UM-" + rev,
  };
}
//Conversion-safe cast to boolean
export function toBool(data) {
  if (
    data == "1" ||
    data == 1 ||
    data == "True" ||
    data == "true" ||
    data == true ||
    data == "on"
  ) {
    return true;
  } else {
    return false;
  }
}
//Count days in month
export function daysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}
//Evaluate time difference between two date objects
export function getDeltaDate(date1, date2) {
  let hours1 = date1.getHours();
  let minutes1 = date1.getMinutes();
  let seconds1 = date1.getSeconds();
  let hours2 = date2.getHours();
  let minutes2 = date2.getMinutes();
  let seconds2 = date2.getSeconds();
  let deltaHours = (hours2 - hours1) * 3600;
  let deltaMinutes = (minutes2 - minutes1) * 60;
  let deltaSeconds = seconds2 - seconds1;
  let deltaTime = deltaHours + deltaMinutes + deltaSeconds;
  return deltaTime;
}
//Format integers in two digits numbers
export function twoDigits(number) {
  return number >= 10 ? number.toString() : "0" + number.toString();
}
//Format date to filename
export function formatDate(date) {
  return (
    date.getFullYear().toString() +
    twoDigits(date.getMonth() + 1) +
    twoDigits(date.getDate()) +
    "_" +
    twoDigits(date.getHours()) +
    twoDigits(date.getMinutes()) +
    twoDigits(date.getSeconds())
  );
}
export function getScript(url) {
  e = document.createElement("script");
  e.src = url;
  e.type = "application/javascript";
  document.body.appendChild(e);
}
//Numeric input custom validation
export function validateNumInput(id) {
  return parseFloat($(id).val().replace(/\s/g, "").replace(",", "."));
}

//Initialization of new page detector-customized style
export function initPageStyle(favicon, style) {
  let favicon_el = document.getElementById("favicon");
  favicon_el.href = favicon; //To be defined in the Controller
  // // Get HTML head element
  // let head = document.getElementsByTagName("HEAD")[0];
  // // Create new link Element
  // let link = document.createElement("link");
  // // set the attributes for link element
  // link.rel = "stylesheet";
  // link.type = "text/css";
  // link.href = style; //To be defined in the Controller
  // // Append link element to HTML head
  // head.appendChild(link);
}
//clear content of HTML container (div)
export function clearDiv(elementID) {
  var div = document.getElementById(elementID);
  while (div.firstChild) {
    div.removeChild(div.firstChild);
  }
}
//calculate sum of array elements
export function array_sum(array) {
  let sum = 0;
  array.forEach((element) => {
    sum += element;
  });
  return sum;
}
//calculate mean of array elements
export function array_mean(array) {
  let mean = 0;
  let count = 0;
  array.forEach((element) => {
    mean += element;
    count++;
  });
  return mean / count;
}
