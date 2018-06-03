
class Log{
	constructor(info,debug,error,ws){
		this.i = true;
		this.d = true;
		this.e = true;
		this.ws = ws;
		if(info != undefined)
			this.i = info;
		if(debug != undefined)
			this.d = debug;
		if(error != undefined)
			this.e = error;
	}
	set(info,debug,error){
		if(info != undefined)
			this.i = info;
		if(debug != undefined)
			this.d = debug;
		if(error != undefined)
			this.e = error;
	}
	info(message){
		if(this.i)
			console.info(message);
		if(this.ws){
			let data = { type:"message", message }
			this.ws.send(JSON.stringify(data));
		}
		return;
	}
	debug(message){
		if(this.d)
			console.log(message);
		return;
	}
	error(message){
		if(this.e)
			console.error(message);
		return;
	}

}

module.exports = Log;
