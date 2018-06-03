const chalk = require('chalk');
const init = require("./port_init.js");


let dummyProf = {
	delay:1,
	rebootingTime:10 * 1000,
	pos:[],
	ec:-1
}

class Plotter{
	constructor(arduino_array, isDebug=false, isDummy=false){
		this.isDebug = isDebug;
		this.isDummy = isDummy;
		this.isDataDebug = false;
		this.ard = arduino_array;
		this.plotterProperty = {};
		this.timeout = 10 * 1000; //30s
		// this.timeout = 60 * 60 * 1000; //1h
		this.timerLog = [];
		this.isOpen = this.setArduinos(arduino_array);
		if(this.isDebug) console.log(chalk.bold.green("Plotter:DEBUG MODE!"));
		if(this.isDummy) console.log(chalk.bold.red("Plotter:Dummy MODE!"));
	}

	async init(){
		if(this.z) await this.z.laserPower(true);
	}

	setArduinos(arduino_array){
		let result;
		if(this.isDummy){
			this.timerLog.push(Date.now());
			result = true;
		} else {
			let result = arduino_array.map((ard) => {
				switch(ard.id){
					case 'x': 
						this.x = ard;
						return true;
					case 'y':
						this.y = ard;
						return true;
					case 'z':
						this.z = ard;
						return true;
					default:
						return false;
				}
			});
			if(result.length && result.reduce((p,c,i,a) => (p && c))) this.timerLog.push(Date.now());
		}
		return result;
	}

	isTimeout(){
		return (Date.now() - this.timerLog[this.timerLog.length-1] > this.timeout);
	}

	async setProperty(){
		let result = [];
		// posをロードする(loadPos)
		const pos = await this.loadPos();
		if(this.isDebug) console.log(`setProperty:loadPos:return ${pos}`);
		if(pos){
			result.push('loadPos');
		}
		// ecをロードする
		if(this.plotterProperty.ec){
			await this.setErrCriteria(this.plotterProperty.ec);
			result.push('ec');
		}
		return result;
	}

	detail(){
		if(this.isDummy){
			return `Dummy Arduino`;
		}
		let str = 'x:';
		if(this.x) str += this.x.port.path;
		else str += "none";
		str += ', y:';
		if(this.y) str += this.y.port.path;
		else str += "none";
		str += ', z:';
		if(this.z) str += this.z.port.path;
		else str += "none";
		str += ',';
		return  str;
	}


	async setPos(x,y,z){
		if(this.isDummy) {
			dummyProf.pos = [x,y,z];
			return promisedelay(dummyProf.delay);
		} else {
			return Promise.all([this.x.setCurVal(x),this.y.setCurVal(y),this.z.setCurVal(z)]);
		}
	}

	//property保存あり
	async getPos(){
		let pos;
		if(this.isDummy){
			pos = dummyProf.pos;
			await promisedelay(dummyProf.delay);
		} else {
			pos = await Promise.all([this.x.getCurVal(),this.y.getCurVal(),this.z.getCurVal()]);
		}
		this.plotterProperty.pos = pos;
		if(this.isDataDebug) console.log(`getPos: pos=${pos}`);
		return pos;
	}

	async loadPos(){
		let pos_array = this.plotterProperty.pos;
		if(!pos_array){
			if(this.isDataDebug) console.log(`loadPos: retrun ${pos_array}`);
			return false;
		}
		await this.setPos(...pos_array); //スプレッド演算子 (Spread Operator)
		return true;
	}

	async moveXY(x,y){
		if(this.isDummy){
			dummyProf.pos.splice(0,2,x,y);
			return await promisedelay(dummyProf.delay);
		} else {
			return Promise.all([this.x.move(x),this.y.move(y)]);
		}
	}
	
	async move2Point(point){
		if(this.isDummy){
			dummyProf.pos = [point.x, point.y, point.z];
			return await promisedelay(dummyProf.delay);
			// return Promise.all([promisedelay(dummyProf.delay)]);
		}else{
			return Promise.all([this.x.move(point.x),this.y.move(point.y),this.z.move(point.z)]);
		}
	}

	async _move2Point(point){
		await this.setPos(point.x, point.y, point.z);
		const pos = await this.getPos();
		return pos;
		// Promise.all([logPromise(point.id+":("+point.x+","+point.y+","+point.z+")"),promisedelay(1)]);
	}

	//property保存あり
	async setErrCriteria(data){ 
		let ret;
		if(this.isDummy){
			ret = `using dummy, ec=${data}nm`;
			dummyProf.ec = data;
		} else {
			ret = await Promise.all([this.x.setErrCriteria(data), this.y.setErrCriteria(data)]);
		}
		if(this.isDebug) console.log(`setErrCriteria: return ${ret}`);
		this.plotterProperty.ec = data;
		return true;
	}

	async getErrCriteria(){
		if(this.isDummy){
			await promisedelay(dummyProf.delay);
			return [dummyProf.ec, dummyProf.ec];
		} else {
			return Promise.all([this.x.getErrCriteria(), this.y.getErrCriteria()]);	
		}
	}
	
	async getLinerErrVal(){
		if(this.isDummy){
			await promisedelay(dummyProf.delay);
			console.log(`this is dummy return value`);
			return [-1,-1]
		} else {
			return Promise.all([this.x.getLinerErrVal(), this.y.getLinerErrVal()]);	
		}
	}
	plot(time){
		return new Promise((resolve,reject) => {
			logPromise(time+"us プロット中")
				.then(() => {
					if(this.isDummy)
						return promisedelay(dummyProf.delay);
					return this.z.rayMicroSec(time);
				})
				.then(resolve)
				.catch(reject)
		})
	}

	async close(){
		if(this.z) await this.z.laserPower(false);
		const closeResult = await Promise.all(
			this.ard.map((a) => {
				return a.close();
			})
		);
		return closeResult;
	}

	async reConnect(){
		if(this.isDebug) console.log("reConnect");
		await this.getPos();
		await this.reOpen();
		await this.setProperty();
		return true;
	}

	async reOpen(){
		if(this.isDummy){
			await promisedelay(dummyProf.rebootingTime);
			this.setArduinos();
		} else {
			await this.close().catch((e) => {
				console.error(e);
				return new Error(`Plotter.reconnect Error: closing port(s) faild. ${e}`);
			});
			let ards = await init.initPorts();
			if(ards.length == 0)
				return new Error(`Plotter.reconnect Error: initializing ports faild.`);
			this.ard = ards;
			this.setArduinos(ards);
			await this.init();
		}
		return this.detail();
	}
}

module.exports = Plotter;

function promisedelay(delay) {
	return new Promise((resolve,reject) => {
		setTimeout(() => {
			resolve(delay);
		},delay);		
	})
}

function logPromise(mes){
	return new Promise((resolve, reject) => {
		// if(isDebug) console.log(chalk.gray(mes));
		resolve(mes);
	})
}
