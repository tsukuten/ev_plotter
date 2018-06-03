var Arduino = require('./arduino_class.js');

class ArduinoZ extends Arduino{
	constructor(id, port){
		super(id, port);
	}

	setRayTime(data){
		return new Promise((resolve,reject) => {
			this.sendData('p',data)
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

	getRayTime(){
		return new Promise((resolve,reject) => {
			this.receiveData('q')
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
	
	gethowZ(){
		return new Promise((resolve,reject) => {
			this.receiveData('x')
				.then(resolve)
				.catch(reject);
		});
	}
	
	setRefVal(){
		return new Promise((resolve,reject) => {
			this.sendCommand('X')
				.then(resolve)
				.catch(reject);
		});
	}
	getSensVal(){
		return new Promise((resolve, reject) => {
			this.receiveData('Y')
			// promiseDelay(500)
				// .then(this.receiveData('Y'))
				.then(resolve)
				.catch(reject)
		})
	}
	getVol(){
		return new Promise((resolve, reject) => {
			this.receiveData('Z')
			// promiseDelay(500)
				// .then(this.receiveData('Z'))
				.then(resolve)
				.catch(reject)
		})
	}
	
////////////////////////////////////////////////////

	move2M(){
		return new Promise((resolve,reject) => {
			this.sendCommand('O')
				.then(resolve)
				.catch(reject);
		});
	}

	move2P(){
		return new Promise((resolve,reject) => {
			this.sendCommand('P')
				.then(resolve)
				.catch(reject);
		});
	}

	move2TarVal(){
		return new Promise((resolve,reject) => {
			this.sendCommand('S')
				.then(resolve)
				.catch(reject);
		});
	}

	zeroSeek(){
		return new Promise((resolve,reject) => {
			this.sendCommand('N')
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

	_ray(time,onDelay){
		// time /= 1000;
		if(onDelay)
			return promisedelay(time);
		else
			return true;
	}

	rayByo(){
		return this.sendCommand('A');
	}

	ray(){
		return this.sendCommand('B');
	}

	laserPower(ONorOFF){
		if(ONorOFF)
			return this.sendCommand('E');
		else 
			return this.sendCommand('F');
	}
	
	rayMicroSec(us){
		return this.setRayTime(us)
			.then(() => {
				return this.ray();
			})
			.catch((e) => {
				console.log("rayMicroSecondError");
				return new Error(e);
			})
	}	

	rayCommand(command){
		return new Promise((resolve, reject) => {
			console.log('raycommand'+command);
			if(typeof(command) !== 'string'){
				reject(new Error('rayCommandの引数がstringではない' + command));
			} else if (command < 'A' || 'K' < command){
				reject(new Error('rayCommandの引数がA~Kの間ではない' + command));
			} else {
				this.sendCommand(command)
					.then(resolve)
					.catch(reject);
				// resolve("plot ok");
			}
		})
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

function promisedelay(delay) {
	return new Promise((resolve,reject) => {
		setTimeout(() => {
			resolve();
		},delay);		
	})
}
function logPromise(log){
	return new Promise((resolve, reject) => {
		console.log(log);
		resolve(log);
	})
}

module.exports = ArduinoZ;
