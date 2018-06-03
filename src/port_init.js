//シリアルポート初期化用

const SerialPort = require("serialport");
const Arduino = require('./arduino_class.js');
const ArduinoX = require('./arduinoX.js');
const ArduinoY = require('./arduinoY.js');
const ArduinoZ = require('./arduinoZ.js');

// for log debug
var l = require('./Log.js');
var log = new l(false,false,false);
const isDebug = true;

function portList() {
	return new Promise(function(resolve, reject){
		SerialPort.list(function(err, ports){
			if(err) {reject(err);}
			log.debug("portList");
			log.debug(ports);
			resolve(ports);
		})
	});
}

function serialInit(ports) {
	return new Promise((resolve,reject) => {
		var s_ports  = [];
		for(var i = 0; i < ports.length; i++){
			try{
				s_ports.push(new SerialPort(ports[i].comName, {
					autoOpen:false, //default:true
					lock:true,      //default:true
					baudRate:115200,	//default:9600	
					dataBits:8,		//default:8
					stopBits:1,		//default:1
					parity:"none",	//default:"none"	
					rtscts:false,	//default:false
					xon:false,		//default:false
					xoff:false,		//default:false
					xany:false,		//default:false
					bufferSize:65536,	//default:65536(int)
					parser: SerialPort.parsers.byteLength(1),
					platformOptions : {  //default:vmin:1,vtime:0
						vmin:1,
						vtime:0
					}
				}));
			} catch(e) {
				log.error(e);
				reject(new Error(e));
			}
		}
		log.debug("serialInit");
		log.debug(s_ports);
		return resolve(s_ports);
	})
}

function serial_open(port){
	return new Promise((resolve,reject) => {
		var arduino_id = null;
		// if(portの型を調べる)
		if(port.open){
			port.open((err)=>{
				if(err){
					log.error("in open error:");
					log.error(port);
					reject(new Error(err));
				}
				port.once('data',(d) => {
					log.info("in open receive : "+d);
					arduino_id = d;
					port.write('x',(err) => {
						if(err) reject(new Error(err));
						log.info("write : "+d);
						port.drain((err) => {
							if(err) reject(new Error(err));
							resolve({port, arduino_id});
						});
					});
				});
			});
		} else {
			log.error("portの型がおかしい");
			log.error(port);
			reject(new Error("portの型がおかしい"));
		}
	});
}

function detectArduino(ports_array){
	return ports_array.map((port_obj) => {
		switch (port_obj.arduino_id.toString()) {
			case 'x':
				log.debug("x is detected");
				return new ArduinoX('x', port_obj.port);
			case 'y':
				log.debug("y is detected");
				return new ArduinoY('y', port_obj.port);
			case 'z':
				log.debug("z is detected");
				return new ArduinoZ('z', port_obj.port);
			default:
				log.error('default');
				return null;
		}
	});
}

function initPorts() {
	return new Promise((resolve,reject) => {
		portList()
			.then((ports) => {
				var r_ports = [];
				for(var i = 0; i < ports.length; i++){
					if(ports[i].locationId || ports[i].vendorId ){ 
						r_ports.push(ports[i])
					}
				}
				return r_ports;
			})
			.then((ports) => serialInit(ports))
			.then((ports) => Promise.all(ports.map((port) => {
				return serial_open(port);
			})))
			.then(detectArduino)
			.then(resolve)
			.catch(reject)
	});
}

/////////////////////////////////////////
function checkArduino(arduino_array){
    let x = false;
    let y = true;
    let z = true;
    // log.error("This check is only for arduinoX");
    return (arduino_array.reduce((p,c) => {
            log.info("check=> Arduino:"+c.id);
            if(c.id === 'x') {
                x = true; 
                return p;
            } else if(c.id === 'y'){
                y = true;
                return p;
            }else if(c.id === 'z'){
                z = true;
                return p;
            }else {
                return false;
            }
        },true)) && x && y && z;
}

function closeArduino(arduino_array){
	return new Promise((resolve, reject) => {
		if(arduino_array){
			Promise.all(ard_array.map((ard) => {
				return ard.close();
			})).then(() => {
				resolve();
			}).catch(reject)
		} else {
			reject(new Error('arduino_arrayが不適切です'+arduino_array));
		}
	});

}

exports.initPorts = initPorts;
exports.checkArduino = checkArduino;
exports.closeArduino = closeArduino;
exports.portList = portList;


