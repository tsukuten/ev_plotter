/*
	interpriter.js
	プロッターインタープリター( Plotter Interpriter )
	プロッターを対話形式で実行する。 Interactively manipulate Plotter.
*/
const chalk = require('chalk');


const todayFile = '../data/hipp_0_exp-10mm.dat';
let isDebug = false;
let isDummy = false;


let finish = false;
const reader = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

reader.setPrompt(chalk.blue('input:'));

// process.stdin.setRawMode(true);

//Promise内の補足されなかった例外について詳細にコンソールに表示する
process.on('unhandledRejection', console.dir);

const SerialPort = require("serialport");

const init = require("./port_init.js");
const Controller = require('./Controller.js');

const repl = require('repl');


const l = require('./Log.js');

let log = new l(true,false,true);

let time = 0;

let instance = {};
const exe = {
	//Arduino{X,Y,Z}やController,Plotterオブジェクトの初期化
	"init": () => {
			return init.initPorts()
				.then((r) => {
					if(r.length || isDummy){
						instance['arduino_array'] = r;
						instance['c'] = new Controller(r,log,isDebug,isDummy);
						if(instance['c'].plotter){
							instance['p'] = instance['c'].plotter;
							if(instance['c'].plotter.x) instance['x'] = instance['c'].plotter.x;
							if(instance['c'].plotter.y) instance['y'] = instance['c'].plotter.y;
							if(instance['c'].plotter.z) instance['z'] = instance['c'].plotter.z;
							return instance['p'].detail();
						}
						return "init fiald: Plotter Object ";
					} else {
						return "No serialport has been found.!! Check your USB in which insert Arduino.";
					}
				})
				.then((result) => {
					if(instance['p']){
						return instance['p'].init()
							.then(() => instance['p'].setErrCriteria(10000))
							.then(result);
					}
					return result;
				})
				.catch((e) => "init faild." + e);
	},
	"portlist":() => {
		return init.portList()
			.then((r) => {
				console.log(r);
				return;
			})
	},
	"close":() => {
			if(instance['c']){
				return instance['c'].close()
					.then(() => {
						instance['c'] = null;
						instance['arduino_array'] = null;
						return 'controller closed';
					});
			} else if(instance['arduino_array']){
				return init.closeArduino(instance['arduino_array'])
					.then(() => {
						instance['c'] = null;
						instance['arduino_array'] = null;
						return 'arduino_array closed';
					});
			} else {
				return Promise.resolve('No Arduinos will close.');
			}
	},
	"detail":() => {
		if(instance['p']) return Promise.resolve(instance['p'].detail());
		else return Promise.resolve('No Controller!!! Please use \'init\' for initializing Controller.');
	},
	"instance": (args) => {
		if(instance[args]) return JSON.stringify(instance[args],undefined,1)
		else return JSON.stringify(instance,undefined,1)	
	}
}

const objexe = {
	c:{
		run:() => {
			// return instance['c'].runPlot(todayFile);
			return instance['c'].runPlot(todayFile);
		},
		_run:() => {
			return instance['c'].checkFile(todayFile);
		},
		setFile:(dataFileName) => {
			console.log(dataFileName);
			console.log(typeof dataFileName);
			if(dataFileName && (typeof dataFileName === 'string' || typeof dataFileName === 'number' )){
				return instance['c'].setFile(dataFileName);
			} else {
				console.error(`Arguments Error: setFile(${dataFileName})`);
				return (`Arguments Error: setFile(${dataFileName})`);

			}
		},
		rError:() => {
			return instance['p'].repetitiveError(50);
		},
		runLong:async () => {
			return await instance['c'].runLong(2 * 60 * 60 * 1000);
		}
	},
	p:{
		move: (x,y,z) => {
			if( x !== undefined && typeof x === 'number' && y !== undefined && typeof y === 'number' && z !== undefined && typeof z === 'number'  ){
				let point = {x,y,z};
				return instance['p'].move2Point(point);
			} else {
				return logPromise("Arguments Error: x="+x+", y="+y+", z="+z);
			}
		},
		movexy:(x,y) =>{
			if( x !== undefined && typeof x === 'number' && y !== undefined && typeof y === 'number'){
				return instance['p'].movexy(x,y);
			} else {
				return logPromise("Arguments Error: x="+x+", y="+y );
			}
		},
		plot:(time)=>{
			if(time !== undefined && typeof time === 'number')
				return instance['p'].plot(time);
		},
		setPos:(x,y,z)=>{
			if(x !== undefined && typeof x === 'number' && y !== undefined && typeof y === 'number' && z !== undefined && typeof z === 'number' )
				return instance['p'].setPos(x,y,z);
			else 
				return logPromise("Arguments Error: x="+x+", y="+y+", z="+z);
		},
		setZero:()=>{
			return instance['p'].setPos(0,0,0);
		},
		getPos:()=>{
			return instance['p'].getPos();
			// return Promise.all[instance['x'].getCurVal(),instance['y'].getCurVal(),instance['z'].getCurVal()];
		},
		getC:(x,y) => {
			if(x !== undefined && typeof x === 'number' && y !== undefined && typeof y === 'number')
			return instance['p'].getCorrectionZ(x,y);
		},
		delay:(time) => {
			l.log("delay"+time);
			return instance['p'].delay(time);
		},
		setEC:(data) => {
			return instance['p'].setErrCriteria(data);
		},
		getEC:()=>{
			return instance['p'].getErrCriteria();
		},
		reconnect:async ()=>{
			let result = await instance['p'].reConnect();
			if(instance['c'].plotter.x) instance['x'] = instance['c'].plotter.x;
			if(instance['c'].plotter.y) instance['y'] = instance['c'].plotter.y;
			if(instance['c'].plotter.z) instance['z'] = instance['c'].plotter.z;			
			return result;
		},
		setprop:async ()=>{
			return instance['p'].setProperty();
		},
		savePos:async ()=>{
			return instance['p'].savePos();
		},
		to:() => {
			return instance['p'].isTimeout();
		},
		loadPos:() => {
			return instance['p'].loadPos();
		}
	},
	x:{
		move:(data)=>{
			if(data !== undefined && typeof data === 'number')
				return instance['x'].move(data);
			else 
				return logPromise("Arguments Error: data="+data);
		},
		setgetTarTest:(data)=>{
			if(data !== undefined && typeof data === 'number')
				return instance['x'].setgetTarTest(data);
			else 
				return logPromise("Arguments Error: data="+data);
		},
		moveby:(data)=>{
			if(data !== undefined && typeof data === 'number')
				return instance['x'].moveby(data);
			else 
				return logPromise("Arguments Error: data="+data);
		},
		setCurVal:(data) => {
			if(data !== undefined && typeof data === 'number')
				return instance['x'].setCurVal(data);
			else 
				return logPromise("Arguments Error: data="+data);
		},
		getCurVal:() => {
			return instance['x'].getCurVal();
		},
		zero:() => {
			return instance['x'].zeroSeek();
		}
	},
	y:{
		move:(data)=>{
			if(data !== undefined && typeof data === 'number')
				return instance['y'].move(data);
			else 
				return logPromise("Arguments Error: data="+data);
		},
		setgetTarTest: (data)=>{
			if(data !== undefined && typeof data === 'number')
				return instance['y'].setgetTarTest(data);
			else
				return logPromise('Arguments Error: data='+data);
		},
		moveby:(data)=>{
			if(data !== undefined && typeof data === 'number')
				return instance['y'].moveby(data);
			else
				return logPromise('Arguments Error: data='+data);
		},
		setCurVal:(data)=>{
			if(data !== undefined && typeof data === 'number')
				return instance['y'].setCurVal(data);
			else
				return logPromise('Arguments Error: data='+data);
		},
		getCurVal:() => {
			return instance['y'].getCurVal();
		},
		zero:() => {
			return instance['y'].zeroSeek();
		},
		sppOn:() => {
			return instance['y'].sppOn();
		},
		sppOff:() => {
			return instance['y'].sppOff();
		}
	},
	z:{
		move:(data)=>{
			if(data !== undefined && typeof data === 'number')
				return instance['z'].move(data);
			else
				return logPromise("Arguments Error。: data="+data);
		},
		setgetTarTest:(data)=>{
			if(data !== undefined && typeof data === 'number')
				return instance['z'].setgetTarTest(data);
			else
				return logPromise("Arguments Error。: data="+data);
		},
		moveby:(data)=>{
			if(data !== undefined && typeof data === 'number')
				return instance['z'].moveby(data);
			else
				return logPromise("Arguments Error。: data="+data);
		},
		ray:(t)=>{
			return instance['z'].rayByo(t);
		},
		move2M:() => {
			return instance['z'].move2M();
		},
		move2P:() => {
			return instance['z'].move2P();
		},
		zeroSeek:() => {
			return instance['z'].zeroSeek();
		},
		gethowZ:() => {
			return instance['z'].gethowZ();
		},
		setCurVal:(data) => {
			if(data !== undefined && typeof data === 'number')
				return instance['z'].setCurVal(data);
			else
				return logPromise("Arguments Error: data="+data);
		},
		getCurVal:() => {
			return instance['z'].getCurVal();
		},
		zero:() => {
			return instance['z'].zeroSeek();
		},
		laserPowerON:()=>{
			return instance['z'].laserPower(true);
		},
		laserPowerOFF:()=>{
			return instance['z'].laserPower(false);
		}
	}
}

function line(){
	return new Promise((resolve, reject) => {
		reader.once('line', function (l) {
			if(l === 'q' || l === 'quit' || l === 'end'){
				// console.log("q fin");
				finish = true;
			}
		  resolve(l);
		});
	});		
}

function cert(message){
	return new Promise((resolve, reject) => {
		if(message && typeof messege == 'string') console.log(message);
		reader.once('line', function (l) {
			if(l.slice(0,1).toLowerCase() === 'y' || l === ''){
				resolve(true);
			} else {
				resolve(false);
			}
		});
	});		
}

function input(){
	return new Promise((resolve, reject) => {
		reader.prompt();
		line().then((l) => {
			if(finish) return 'interpriter finished';
			return parse(l);
		})
		.then((d) => {
			console.log(chalk.magenta(`Returned Value:${d}`));
		})
		.catch((e) => {
			console.log(chalk.magenta(`Run-time Error:${e}`));
			resolve();
		})
		.then(resolve);
	});
}

async function run(){
		time = new Date().getTime();
		await input();
		while(!finish){
			console.log(chalk.inverse(`  ${new Date().getTime()-time} ms  `));
			await input();
		}
}

function parse(str){
	let s = str.split(':');
	let p = [];
	return Promise.all(s.map((s) => {
		let n = s.indexOf('.');
		if(n != -1){
			let obj = s.slice(0,n).trim();
			let method_str = s.slice(++n).trim();
			let meth = handleMethod(method_str);
			console.log(`Parsing: ${obj}.${meth.method}`);
			if(meth.args.length) console.log(`Args:${meth.args}`);
			return makePromise(obj, meth.method, meth.args);
		}else{
			console.log(`Parsing: ${s}`);
			let meth = handleMethod(s);
			if(meth.args.length) console.log(`Args:${meth.args}`);
			return makePromise(null, meth.method, meth.args);
		}
	}));
}

function makePromise(obj, method, args){
	time = new Date().getTime();
	console.log(`Making Process: obj:${obj} method:${method} args:${args}`);
	if(obj != null){
		if(!instance[obj]) return logPromise('オブジェクトがないよ〜: obj='+obj+' : object='+instance[obj]);
		console.log("makepromise");
		if(objexe[obj][method]) {
			console.log(args);
			if(args) return objexe[obj][method](...args);
			else return objexe[obj][method](null);

		} else return logPromise("オブジェクトあるけどメソッドないよ-: obj="+obj+": method="+method);
	} else if(exe[method]){
		console.log("method:"+method);
		if(args) return exe[method](...args);
		else return exe[method](null);
	} else {
		return logPromise("そんなコマンドないよ~:"+method);
	}
}

function handleMethod(method_str){
	let method;
	let args;
	let left = method_str.indexOf('(');
	let right = method_str.indexOf(')');
	if(left != -1 && right != -1 && left < right){
		let args_str = method_str.slice(left+1,right);
		args = args_str.split(',').map((a) => {
			let a_trimed = a.trim();
			if(a_trimed == '') return null;
			let pat = /^[-]?([1-9]\d*|0)$/;
			if(pat.test(a_trimed)) return parseInt(a_trimed);
			else return a_trimed;
		}).filter((a) => {
			return a != null;
		});
		method = method_str.slice(0,left);
		return {method,args};
	} else {
		return {method:method_str,args:[]};
	}
}

function logPromise(log,bool){ //if bool is false, outputs log
	return new Promise((resolve, reject) => {
		if(!bool) console.log(log);
		resolve(log);
	})
}


// check arguments
for(var i = 0;i < process.argv.length; i++){
  if(process.argv[i] === '--debug')
  	isDebug = true;
  if(process.argv[i] === '--dummy')
  	isDummy = true;
}

//START!!!
console.log(chalk.underline.red("begin init"));
parse("init")
	.then((d) => {
		console.log(d);
		return run();
	}).then( () => process.exit() )
	.catch((e) => console.error);	


