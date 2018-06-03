//Arduinoの
// var l = require('tracer').console();
var calc = require('./calcData.js');

var l = require('./Log.js');
var log = new l(true,false,true);


class Arduino_port {
	constructor(id,port){
		//arduinoのid x,y,z のいずれか
		this.id = id;
		this.name = "arduino"+id;
		//SerialPort
		this.port = port;
		this.timeover = 10000; //10s 
		this.buffer =[];
		this.bufwait = false;
		this.start();
	}

	start(){
		this.port.on('data',(d) => {
			log.debug(this.name + " on data:"+d+" wait"+this.bufwait);
			if(!this.bufwait){
				this.buffer.push(d);
			}else{
				this.bufwait = false;
			}
		});
	}

	getBuffer(){
		return new Promise((resolve, reject) => {
			if(this.buffer.length !== 0){
				resolve(this.buffer.shift());
			} else {
				log.debug("bufferwait");
				if(this.bufwait) {
					log.error("ERROR:arduino_class:getBuffer:" + this.name + " buffer error");
					reject(new Error("重複して同じArduinoの関数が使われている可能性があります。"));
				}
				this.bufwait = true;
				this.port.once('data',(d) => {
					resolve(d);
				})
			}
		});
	}

	close(){
		return new Promise((resolve, reject) => {
			this.port.close((e) => {
				if(e) reject(e);
				log.info(this.name+":"+this.port.path+" was closed");
				resolve();
			});
		});
	}

	sendData(command,sdata){
		return new Promise((resolve, reject) => {
			log.debug(this.name + "in sendCommand:"+command);
			this.getBuffer()
				.then((data) => {
					// log.info('1:'+data);
					if(data == command){ //最初の検知
						return this.send4byte(sdata)
					} else {
						log.error("ERROR:sendData:" + this.name + 'command is not match: command='+command+' data='+data);
						reject(new Error('command is not match: command='+command+' data='+data));
					}
				}).then(() => {
					return this.getBuffer();
				}).then((d) => {
					// log.info('2:'+d);
					if(d == 'm'){
						resolve();
					} else {
						log.error("ERROR:sendData:" + this.name + 'fin signal is not n: signai is '+d)
						reject(new Error('fin signal is not n: signai is '+d));
					}
				}).then(() => {

				})
			// log.info(this.name+" is Open : "+this.port.isOpen());
			this.port.write(command);
		});
	}

	receiveData(command){
		return new Promise((resolve, reject) => {
			// log.info("in sendCommand:"+command);
			let rec_data = null;
			this.getBuffer()
				.then((data) => {
					// log.info('1:'+data);
					if(data == command){ //最初の検知
						return this.receive4byte()
					} else {
						reject(new Error('command is not match: command='+command+' data='+data));
					}
				}).then((fourb) => {
					rec_data = calc.byteArray2num(fourb);
					return this.getBuffer();
				})
				.then((data) => {
					// log.info('2:'+data);
					if(data == 'm'){
						resolve(rec_data);
					} else {
						reject(new Error('fin signal is not n: signai is '+d));
					}
				});
			// log.info(this.id+" is Open : "+this.port.isOpen());
			this.port.write(command);
		});	
	}

	send4byte(data){
		return new Promise((resolve, reject) => {
			if(typeof(data) !== 'number' || data > 2147483647){
				reject(new Error('write4byte:data is invalid:'+data));
			}
			let data_array = calc.num2byteArray(data);
			// log.info(data_array);
			this.port.write(data_array,(e) => {
				if(e) reject(new Error(e));
				this.port.drain((err) => {
					if(err) reject(new Error(err));
					resolve(true);
				})
			});
		});
	}

	receive4byte(){
		return new Promise((resolve, reject) => {
			//timeoutの設定
			let result = [];
			this.getBuffer()
				.then((d1) => {
					result.push(d1);
					return this.getBuffer();
				}).then((d2) => {
					result.push(d2);
					return this.getBuffer();
				}).then((d3) => {
					result.push(d3);
					return this.getBuffer();
				}).then((d4) => {
					result.push(d4);
					resolve(result);
				});
		});
	}

	sendCommand(command){
		return new Promise((resolve, reject) => {
			// log.info("in sendCommand:"+command);
			this.getBuffer()
				.then((data) => {
					// log.info('1:'+data);
					if(data == command){ //最初の検知
						return this.getBuffer()
					} else {
						reject(new Error('command is not match: command='+command+' data='+data));
					}
				}).then((d) => {
					// log.info('2:'+d);
					if(d == 'm'){
						resolve();
					} else {
						reject(new Error('fin signal is not n: signai is '+d));
					}
				});
			// log.info(this.id+" is Open : "+this.port.isOpen());
			this.port.write(command);
		});
	}
}

module.exports = Arduino_port;