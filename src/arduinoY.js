var Arduino = require('./arduino_class.js');

class ArduinoY extends Arduino{
	constructor(id, port){
		super(id, port);
	}

	setErrCriteria(data){
		return new Promise((resolve,reject) => {
			this.sendData('k',data)
				.then(resolve)
				.catch(reject);
		});		
	}
	
	setTarVal(data){
		return new Promise((resolve,reject) => {
			this.sendData('s',data)
				.then(resolve)
				.catch(reject);
		});
	}
	setCurVal(data){
		return new Promise((resolve,reject) => {
			this.sendData('t',data)
				.then(resolve)
				.catch(reject);
		});
	}
	setmoveby(data){
		return new Promise((resolve,reject) => {
			this.sendData('r',data)
				.then(resolve)
				.catch(reject);
		});
	}

	getErrCriteria(){
		return new Promise((resolve,reject) => {
			this.receiveData('l')
				.then(resolve)
				.catch(reject);
		});		
	}
	
	getErrCount(){
		return new Promise((resolve,reject) => {
			this.receiveData('E')
				.then(resolve)
				.catch(reject);
		});		
	}

	getTarVal(){
		return new Promise((resolve,reject) => {
			this.receiveData('u')
				.then(resolve)
				.catch(reject);
		});
	}

	getCurVal(){
		return new Promise((resolve,reject) => {
			this.receiveData('v')
				.then(resolve)
				.catch(reject);
		});
	}

	getLinerErrVal(){
		return new Promise((resolve,reject) => {
			this.receiveData('o')
				.then(resolve)
				.catch(reject);
		});
	}

////////////////////////////////////////////////////

	move2TarVal(){
		return new Promise((resolve,reject) => {
			this.sendCommand('S')
				.then(resolve)
				.catch(reject);
		});
	}
	move2moveby(){
		return new Promise((resolve,reject) => {
			this.sendCommand('T')
				.then(resolve)
				.catch(reject);
		});
	}
	zeroSeek(){
		return new Promise((resolve,reject) => {
			this.sendCommand('R')
				.then(resolve)
				.catch(reject);
		});
	}
	sppOn(){
		return new Promise((resolve,reject) => {
			this.sendCommand('G')
				.then(resolve)
				.catch(reject);
		});
	}
	sppOff(){
		return new Promise((resolve,reject) => {
			this.sendCommand('H')
				.then(resolve)
				.catch(reject);
		});
	}
//////////////////////////////////////////////////////
	move(data){
		return new Promise((resolve, reject) => {
			this.setTarVal(data)
				.then(() => {
					return this.move2TarVal();
				}).then(resolve)
				.catch(reject);
			});
	}

//////////////////////////////////////////////////////
	setgetTarTest(data){
		return new Promise((resolve, reject) => {
			this.setTarVal(data)
				.then(() => this.getTarVal())
				.then((d) => {
					if(d === data){
						resolve(new Date());
					} else {
						reject(new Error('setgetTarTest is faild: send:'+data+" receive:"+d));
					}
				})
				.catch(reject);
		});
	}
	moveby(data){
		return new Promise((resolve, reject) => {
			this.setmoveby(data)
				.then(() => {
					return this.move2moveby();
				}).then(resolve)
				.catch(reject);
			});
	}
}


module.exports = ArduinoY;
