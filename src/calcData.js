// var l = require('tracer').console();

var l = require('./Log.js');
var log = new l(false,false,true);
// var log = new logClass(true,true,true);
// log.set(true,true,true);

function num2byteArray(data){
	let div = 4;
	let byteSize = 8;
	let prefix = 0x000000ff;
	var result = [];
	for(var i = 0; i < div; i++){
		result.push(prefix & data);
		data = data >>> byteSize;
	}
	return result;
}


function byteArray2num(data_array){
		let tmp = Buffer.concat(data_array)
		log.debug("calcData.js:byteArray2num:Read Int32LE");
		log.debug(tmp.readInt32LE());
		return tmp.readInt32LE();
    // return data_array.reduceRight((p,c) => {
    // 	// let n = c.readUInt8();
    // 	return (p << 8) + n; 
    // });
}

exports.num2byteArray = num2byteArray;
exports.byteArray2num = byteArray2num;

// l.info(num2byteArray(8));
// var test = [0,1,-1,8,-8,16,-16,32,-32,127,-127,128,-128,2147483647,-2147483648,2147483646,-2147483647];
// for(var i = 0; i < 2147483647; i++){
// 	if(i === byteArray2num(num2byteArray(i))){
// 		// l.info(i)
// 	} else {
// 		l.error("///////////////"+i);
// 	}
// }