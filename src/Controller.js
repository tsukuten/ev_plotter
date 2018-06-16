const fs = require('fs');
const chalk = require('chalk');
const Plotter = require('./Plotter.js');
const readline = require('readline');
const portInit = require('./port_init.js');
const logUpdate = require('log-update');

process.on('unhandledRejection', console.dir);


var l = require('./Log.js');
var log = new l(true, false, true);

//恒星データ一行の長さ
const READ_BUFF_SIZE = 55;
//平面補正を加えるかどうか
const ENABEL_CORRECT = false;
//面の傾きのx(A),y(B)の係数
// const B = 0.000832359;
// const A = -0.0000302126;


const DATA_FILE_PATH = "../data/";
//面の傾きのx(A),y(B)の係数
// const B = 0.000832359;
// const A = -0.0000302126;

class Controller {
	constructor(arduino_array, log, isDebug=false, isDummy=false){
		this.isDebug = isDebug;
		this.isDataDebug = false;
		this.plotter = new Plotter(arduino_array, isDebug, isDummy);
		this.runFile = null;
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
			const errmsg = `setFile Error: runFile=${fullpath}: ${err}`;
			console.error(errmsg);
			this.runFile = null;
			return new Error(errmsg);
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
				console.log.error("id:" + data.id + " NG. data=(" + data.x + "," + data.y + "," + data.z + "," + data.t + ")");
				return false;
			}
		};
		this.setcData();
		return Promise.all([this.getnData(rs), checkpro(this.cData)]);
	}

	makeFileStream(filename) {
		if(this.isDebug) console.log("in initreadstream");
		// this.filefin = false;
		let readStream = fs.createReadStream(filename);
		let rl = readline.createInterface(readStream, null, null);
		rl.on('line', (l) => {
			if(this.isDataDebug) console.log(`readline:${l}`);
			if(l)
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
			if(this.isDataDebug)
				console.log("waitData lock");
			let lineCo = function() {
				if(this.isDataDebug)
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

	async runPlot(runfilepath, isPostPlot){
		let filepath = (runfilepath ? runfilepath : this.filepath);
		console.log("makeFileStream:" + filepath);
		const {num, errnum} = await this.setFile(filepath);
		if(errnum > 0) return new Error(`runPlot:setFile Error: errnum=${errnum} filepath=${filepath}`);
		let rs = this.makeFileStream(filepath);
		await this.getnData(rs);
		console.log("startPlotting");
		let resultIdArray = [];
		let id;
		let diff = ''; //only use for Debug
		while(this.nData != null){
			id = await this.moveAndPlot(rs)
			if(this.isDebug){
				let d = await this.plotter.getPos();
				diff += (`${this.cData.id},${this.cData.x - d[0]},${this.cData.y - d[1]},${this.cData.z - d[2]}\n`);			 
			}
			resultIdArray.push(id);
			if(this.isDataDebug){
				console.log(`nData:${JSON.stringify(this.nData)} cData:${JSON.stringify(this.cData)}`);
			} else {
				logUpdate(chalk.inverse(`  ${parseInt(100 * resultIdArray.length / num)}%   id=${resultIdArray[resultIdArray.length-1]}  `));
			}
		}
		if(isPostPlot){
			await postPlot();
		}
		if(this.isDebug){
			console.log(JSON.stringify(resultIdArray));
			console.log(diff);
			console.log(`arduinoX,Y LinerErrVal=${await this.plotter.getLinerErrVal()}`);
		}
		return resultIdArray.length;	
	}

	async postPlot(){
		const crossPos = [ [3000000,3000000],[4230000,4230000], 
						   [35860000,4230000],[37000000,3000000],
						   [37000000,37000000],[35860000,35860000],
						   [4230000,35860000],[3000000,37000000],
						   [20000000,20000000] ];
		const makeCross = async (x,y) => {
			const n = 5; //nはクロスの一辺の数. nは奇数推奨
			const diff = 250000;
			const z = 505301;
			const t = 1010;
			for(let i = 0; i < n; i++){
				const nx = x - Math.floor(n/2) * diff + diff * i + diff*((n+1)%2)/2;
				const ny = y;
				await this.plotter.plotPoint(nx, ny, z, t)
				    .catch((e)=>{console.error(`ERROR:plotPoint(${x}, ${y}, ${z}, ${t}):${e}`)});
				const pos = await this.plotter.getPos();
			}
			for(let i = 0; i < n; i++){
				const nx = x;
				const ny = y - Math.floor(n/2) * diff + diff * i + diff*((n+1)%2)/2;
				if(x == nx && y == ny) continue;
				await this.plotter.plotPoint(nx, ny, z, t)
				    .catch((e)=>{console.error(`ERROR:plotPoint(${x}, ${y}, ${z}, ${t}):${e}`)});
				const pos = await this.plotter.getPos();		    
			}			
		}
		for(let i = 0; i < crossPos.length; i++){
			await makeCross(...crossPos[i]);
		}
		return;		
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
	
	async runLong(howlong=3600000){
		console.log(`runLong(${howlong})`);
		const start = Date.now();
		const dim = 30 * 1000;
		let count = 0;
		let last = this.plotter.timerLog[this.plotter.timerLog.length-1];
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
	if (buf && buf.length < READ_BUFF_SIZE) return null;
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
	return Math.floor(-270.261 + (-1 * (-0.158267 * x / 1000000 + 0.0053395 * y / 1000000 + 31.0659) / 0.205146 * 1000) + 400000) - 248296;
}

module.exports = Controller;