const fs = require('fs');
const chalk = require('chalk');
const Plotter = require('./Plotter.js');
const readline = require('readline');
const portInit = require('./port_init.js');
const logUpdate = require('log-update');

process.on('unhandledRejection', console.dir);


var l = require('./Log.js');
var log = new l(true, false, true);

const READ_BUFF_SIZE = 56;

const ENABEL_CORRECT = false;

const DATA_FILE_PATH = "../data/";
//面の傾きのx(A),y(B)の係数
// const B = 0.000832359;
// const A = -0.0000302126;

class Controller {
	constructor(arduino_array, log){
		this.isDebug = true;
		this.plotter = new Plotter(arduino_array);
		this.runFile = null;
		this.filefin = false;
		this.nData = null;		//nextData:次にプロットするデータ
		this.cData = null;		//currentData:現在プロットしようとしているデータ
		this.buf = [];				//星のデータの一時的な保存場所
		this.fileLength = 0;
		this.log = log;
		if(this.isDebug) console.log(chalk.bold("Controller:DEBUG MODE"));
	}

	async setFile(filename) {
		let fullpath = DATA_FILE_PATH + filename;
		try {
			fs.statSync(fullpath);
			this.runFile = fullpath;
			console.log("ファイルを設定しました. runFile=" + fullpath);
			return await this.checkFile(this.runFile);
		} catch (err) {
			this.log.error("setFile Error: runFile=" + fullpath + "::" + err);
			this.runFile = null;
			return new Error(err);
		}
	}

	async checkFile(filename) {
		console.log(`checkFile:validating star datas in ${filename}`);
		let num = 0;
		let errnum = 0;
		let rs = this.makeFileStream(filename);
		await this.getnData(rs);
		while(this.nData){
			let ret = await this.checkData(rs);
			ret[1] ? num++ : errnum++;
		}
		console.log(`OK:${num}`);
		console.log(`NG:${errnum}`);
		console.log(`SUM:${num + errnum}`);
		return {num, errnum};
	}

	checkData(rs) {
		let checkpro = (data) => {
			if (data.x !== undefined && data.y !== undefined && data.z !== undefined && data.t != undefined) {
				// console.log("id:"+data.id+" ok. data=("+ data.x + "," + data.y + "," + data.z + "," + data.t + ")");
				return true;
			} else {
				this.log.error("id:" + data.id + " NG. data=(" + data.x + "," + data.y + "," + data.z + "," + data.t + ")");
				return false;
			}
		};
		this.setcData();
		return Promise.all([this.getnData(rs), checkpro(this.cData)]);
	}

	makeFileStream(filename) {
		if(this.isDebug) console.log("in initreadstream");
		this.filefin = false;
		let readStream = fs.createReadStream(filename);
		let rl = readline.createInterface(readStream, null, null);
		rl.on('line', (l) => {
			// if(this.isDebug) console.log(`readline:${l}`);
			this.buf.push(l);
		})
		return rl;
	}

	setcData() { this.cData = this.nData; return; }

	//恒星データをthis.nDataへ格納する関数
	getnData(rl) {
		return new Promise((resolve, reject) => {
			if (this.buf.length > 0) {
				this.nData = makeStar(this.buf.shift());
				resolve(rl);
			} else {
				if (rl.input.closed) {
					console.log("file closed");
					resolve(rl);
					this.nData = null;
				} else {
					return this.waitData(rl)
						.then(() => {
							if (rl.input.closed) {
								this.nData = null;
								resolve(rl);
							}
							this.nData = makeStar(this.buf.shift());
							resolve(rl);
						});
				}

			}
		})
	}

	waitData(rl) {
		return new Promise((resolve, reject) => {
			this.log.debug("waitData lock");
			let lineCo = function() {
				this.log.debug("waitData unlock");
				rl.removeListener("close", resolve);
				resolve();
			}
			rl.once('line', lineCo.bind(this));
			rl.once('close', resolve);
		})
	}

	//this.cDataへの移動とファイルから恒星データをthis.nDataへ格納する関数
	//rsはファイルのストリームであり、getnDataを行うのに用いる
	moveAndLoad(rs) {
		return new Promise((resolve, reject) => {
			this.setcData();
						Promise.all([this.getnData(rs), this.plotter.move2Point(this.cData)])
				.then(resolve)
				.catch(reject);
		});
	}

	//moveAndLoadでthis.cDataに移動し、this.cData.tの時間だけプロットを行う
	//rsはファイルのストリームでありmoveAndLoadにそのまま渡している。
	moveAndPlot(rs) {
		return new Promise((resolve, reject) => {
			return this.moveAndLoad(rs)
				.then(() => {
					return this.plotter.plot(this.cData.t);
					// return this.plotter.plot(1);
				})
				.then(() => {
					resolve(this.cData.id);
				})
				.catch(reject);
		})
	}

	//runfilepathで指定されたデータのx,y,zを元に傾きを測定するための関数
	getPlane(runfilepath) {
		return new Promise((resolve, reject) => {
			let filepath = (runfilepath ? runfilepath : this.runFile);
			console.log("makeFileStream:" + filepath);
			let res = [];
			this.makeFileStream(filepath)
				.then((rs) => { //rs:readstream
					return this.getnData(rs);
				})
				.then(function loop(rs) {
					if (!this.nData) {
						res.reduce((p, c, i, a) => {
							c.howz -= p;
							return p;
						}, res[0].howz);
						resolve(res);
					} else {
						return this.moveAndLoad(rs)
							.then(() => {
								return this.plotter.z.zeroSeek();
							})
							.then(() => {
								return this.plotter.getPos();
							})
							.then((pos_array) => {
								let data = {
									x: pos_array[0],
									y: pos_array[1],
									z: pos_array[2]
								};
								res.push(data);
								return;
							})
							.then(() => {
								return this.plotter.z.gethowZ();
							})
							.then((howZ) => {
								res[res.length - 1]["howz"] = howz;
								return;
							})
							.then(() => {
								return this.plotter.z.move(0);
							})
							.then(loop.bind(this, rs))
							.catch((e) => logPromise(e))
					}
				}.bind(this))
				.catch(reject);
		})
	}

	//getPlaneのデバッグ用関数
	_getPlane(runfilepath) {
		return new Promise((resolve, reject) => {
			console.log(chalk.red(runfilepath));
			let filepath = (runfilepath ? runfilepath : this.runFile);
			console.log("makeFileStream:" + filepath);
			let res = [];
			this.makeFileStream(filepath)
				.then((rs) => { //rs:readstream
					return this.getnData(rs);
				})
				.then(function loop(rs) {
					if (!this.nData) {
						printrs(res);
						resolve();
					} else {
						return this._moveAndLoad(rs)
							.then(loop.bind(this, rs))
							.catch((e) => logPromise(e))
					}
				}.bind(this))
				.catch(reject);
		})
	}

	async runPlot(runfilepath){
		let filepath = (runfilepath ? runfilepath : this.filepath);
		console.log("makeFileStream:" + filepath);
		const {num, errnum} = await this.setFile(filepath);
		if(errnum > 0) return new Error(`runPlot:setFile Error: errnum=${errnum} filepath=${filepath}`);
		let rs = this.makeFileStream(filepath);
		await this.getnData(rs);
		console.log("startPlotting");
		let resultIdArray = [];
		let id;
		while(this.nData != null){
			// if(this.plotter.isTimeout()){
			// 	logUpdate(chalk.inverse(`  ${parseInt(100 * resultIdArray.length / num)}%   id=${resultIdArray[resultIdArray.length-1]}  `, chalk.reset(` `) ,chalk.magenta(`RECONNECTING 💤`)))
			// 	await this.plotter.reConnect();
			// }
			id = await this.moveAndPlot(rs)
			resultIdArray.push(id);
			// console.log(`nData:${JSON.stringify(this.nData)} cData:${JSON.stringify(this.cData)}`);
			logUpdate(chalk.inverse(`  ${parseInt(100 * resultIdArray.length / num)}%   id=${resultIdArray[resultIdArray.length-1]}  `));
		}
		if(this.isDebug) console.log(JSON.stringify(resultIdArray));
		return resultIdArray.length;		
	}	

	//同じ位置でのZ軸の繰り返し誤差をn回測定する。 new
	async repetitiveError(n) {
			let isFinish = false;
			let res = [];
			let x,y,z;
			console.log(chalk.bold("repetitiveError"));
			for(let i = 0; i < n; i++){
				await this.plotter.z.zeroSeek();
				[x,y,z] = await this.plotter.getPos();
				res.push({x,y,z});
				await this.plotter.z.move(0);
			}
	}

	close() {
		if (this.plotter) {
			return this.plotter.close();
		} else {
			console.error("this.plotter was not initialized!");
			return null;
		}
	}
	
	async runLong(howlong){
		console.log(`runLong(${howlong})`);
		const start = Date.now();
		const dim = 30 * 1000;
		let count = 0;
		let last = this.plotter.timerLog[this.plotter.timerLog.length-1];
		await this.plotter.setErrCriteria(10);
		while(Date.now() - start < howlong){
			console.log(`${start}, ${Date.now() - start},: ${Date.now()} , ${last}, ${dim}, ${Date.now() - last}`);
			if(Date.now() - last > dim){
				count++;
				console.log(`runLong: count = ${count}`);
				let pos = await this.plotter.getPos();
				console.log(`getPos:return ${pos}`);
				await this.plotter.setPos(++pos[0], ++pos[1], ++pos[2]);
				await this.plotter.getPos();
				await this.plotter.reOpen();
				const ret = await this.plotter.setProperty();
				console.log(`setProperty:${ret}`);
				last = this.plotter.timerLog[this.plotter.timerLog.length-1];
			}
			await promisedelay(1000);
		}
		return count;
	}
}

function makeStar(buf) {
	if (buf && buf.length < 54) return null;
	var id = parseInt(buf.slice(0, 10));
	var x = parseInt(buf.slice(11, 21));
	var y = parseInt(buf.slice(22, 32));
	var z = parseInt(buf.slice(33, 43));
	if (ENABEL_CORRECT) {
		let dd = getCorrectionZ(x, y);
		console.log("Correction z:" + dd);
		z -= dd;
	}
	var t = parseInt(buf.slice(44, 54));
	return { id, x, y, z, t };
}

function promisedelay(delay) {
	return new Promise((resolve, reject) => {
		setTimeout(() => {
			resolve(delay);
		}, delay);
	})
}

function logPromise(log) {
	return new Promise((resolve, reject) => {
		console.log(log);
		resolve(log);
	})
}

function printrs(res) {
	for (var i = 0; i < res.length; i++) {
		console.log(res[i].x + "," + res[i].y + "," + res[i].z + "," + res[i].howz);
	}
}

function getCorrectionZ(x, y) {
	// return -1 * correctZ[idcorrect++];
	// let hosei = -270.261+(-1*(-0.158267*x/1000000+0.0053395*y/1000000+31.0659)/0.205146);
	// return -1 * Math.floor(hosei * 1000 + 400000) - 21695;
	return Math.floor(-270.261 + (-1 * (-0.158267 * x / 1000000 + 0.0053395 * y / 1000000 + 31.0659) / 0.205146 * 1000) + 400000) - 248296;
	// return -1 * Math.floor(A*x + B*y + 0.5);
}

module.exports = Controller;