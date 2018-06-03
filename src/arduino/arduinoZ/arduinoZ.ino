/*
 * Arduino Mega 
 * 使用ピン analog: なし, digital:22,24,52,53,40,
*/
#include <Wire.h>
#define UP HIGH
#define DOWN LOW
#define ON HIGH
#define OFF LOW
#define dataSize 4
#define byteSize 8
#define packetSize 4
#define DEF_VAL 1.25
#define DEF_ADJ 1000
#define STEP_SIZE 500

char state = 'n';
long tarVal,curVal = 0;
long howZ = 0;
long volt = 0;
long moveby = 0;
long rayTime = 0;

//Serial用変数
const long DATA_RATE = 115200;
char syncChar = 'z';
int c = -1;



//Zステージ用変数
uint8_t cw = 22;
int ccw = 24;
int os = 51; //origin sensor
int ls_p = 52;//limit sensor plus
int ls_m = 53;//limit sensor minus
boolean s_ls_p, s_ls_m, s_os;
boolean run = true;
uint8_t bit_os,bit_ls_p,bit_ls_m,port_os,port_ls_p,port_ls_m;

//レーザ照射用
int laserPower_sw = 41;
int ray_sw = 40;
long cor_val = 0; //レーザセンサ出力値の基準点
//
// ----- I2Cの各種設定 -----
const byte INA226_ADDR = B1000000;
const byte INA226_CONFIG = 0x00;
const byte INA226_BUSV   = 0x02;
const byte INA226_POWER  = 0x03;
const byte INA226_CALIB  = 0x05;
const byte INA226_MASK   = 0x06;
const byte INA226_ALERTL = 0x07;
const byte INA226_DIE_ID = 0xff;

void setup()
{
  delay(1000);
  
  Serial.begin(DATA_RATE);
  while(!Serial){}

  pinMode(cw,OUTPUT);
  pinMode(ccw,OUTPUT);
  pinMode(os,INPUT);
  pinMode(ls_p,INPUT);
  pinMode(ls_m,INPUT);
  pinMode(ray_sw,OUTPUT);
  digitalWrite(ray_sw,LOW);
  pinMode(laserPower_sw,OUTPUT);
  digitalWrite(laserPower_sw,LOW);
  digitalWrite(ccw,UP); //LOW is up, HIGH is down. default is up
  {
	bit_os = digitalPinToBitMask(os);
	port_os = digitalPinToPort(os);
	s_os = (*portInputRegister(port_os) & bit_os) ? true : false;

	bit_ls_p = digitalPinToBitMask(ls_p);
	port_ls_p = digitalPinToPort(ls_p);
	s_ls_p = (*portInputRegister(port_ls_p) & bit_ls_p) ? true : false;

	bit_ls_m = digitalPinToBitMask(ls_m);
	port_ls_m = digitalPinToPort(ls_m);
	s_ls_m = (*portInputRegister(port_ls_m) & bit_ls_m) ? true : false;
  }
 
	INA226_setup();
	
	sync();
}

boolean changeState(char newstate){
	if(newstate != -1){
		Serial.write(newstate);
		state = newstate;
	} else {
		state = 'e';
	}
}


boolean switchOp(char c){
	switch (c){
		case -1:
			changeState('e');
			break;
		case 'n':
			changeState('n');
			break;
		//////////////////////////////////////
		case 'p':
			changeState('p');
			rayTime = receiveData();
			break;
		case 'q':
			changeState('q');
			sendData(rayTime);
			break;
		case 'r':
			changeState('r');
			moveby = receiveData();
			break;
		case 's':
			changeState('s');
			tarVal = receiveData();
			break;
		case 't':
			changeState('t');
			curVal = receiveData();
			break;
		case 'u' :
			changeState('u');
			sendData(tarVal);
			break;
		case 'v':
			changeState('v');
			sendData(curVal);
			break;  
		case 'w': //for debug only delay
			changeState('w');
			delay(1000);
			break;
		case 'x':
			changeState('x');
			sendData(howZ);
			break;
		///////////////////////////////////////
		case 'A':
			changeState('A');
		   	rayMicroSec(1000000);
		   	break;
		case 'B':
			changeState('B');
		   	rayMicroSec(rayTime);
		   	break;
		/////////////////////////////////////////
		case 'E':
			changeState('E');
			laserPower(ON);
			break;
		case 'F':
			changeState('F');
			laserPower(OFF);
			break;
		case 'M':
			changeState('M');
			zsw_test();
			break;
		case 'N':
			changeState('N');
			move_origin(true);
			break;
		case 'O':
			changeState('O');
			move_m_origin(true);
			break;
		case 'P':
			changeState('P');
			move_p_origin(true);
			break;
		case 'S':
			changeState('S');
			zMoveTarVal();
			break;
		case 'T':
			changeState('T');
			zmove(moveby);
			break;
		case 'W':
			changeState('W');
			sendData(cor_val);
			break;
		case 'X':
			changeState('X');
			cor_val = volt2point(read_v());
			break;
		case 'Y':
			changeState('Y');
			sendData(volt2point(read_v()));
			break;
		case 'Z':
			changeState('Z');
			volt = read_v();
			sendData(volt);
			break;
		/////////////////////////////////////////////
		default:
			changeState('f');
			return false;
			break;
	}
	return true;
}

void loop() {
  if(Serial.available() > 0){
	c = Serial.read();
	switchOp(c);
	changeState('m');
  }
}

void rayMicroSec(long t){
	digitalWrite(ray_sw,HIGH);
	if(t > 2000){
		delay(t/1000); //ms
	} else {
		delayMicroseconds(t); //microsecond
	}
	digitalWrite(ray_sw,LOW);
}

void zMoveTarVal(){
	long diff = tarVal - curVal;
	// curVal = tarVal;
	zmove(diff);
}
void zmove(long point){
	long stepn = 0;
	if(point > 0){
		stepn = point2step(point);
		_zmove(UP,stepn);
		curVal += stepn * STEP_SIZE;
	} else {
		stepn = point2step(-point);
		_zmove(DOWN,stepn);
		curVal -= stepn * STEP_SIZE;
	}
}
void _zmove(boolean dir,long stepn){
	digitalWrite(ccw,dir);
	uint8_t port = digitalPinToPort(cw);
	volatile uint8_t *out= portOutputRegister(port);
	uint8_t bit_mask = digitalPinToBitMask(cw);
	int n = 0;
	while( n < stepn ){
		*out |= bit_mask;
		delayMicroseconds(500);
		*out &= ~bit_mask;
		delayMicroseconds(500);
		n++;
	}
}

//正の値でのステップ座標換算(絶対値 = 移動量)だけ考えれば良い
long point2step(long point){
	long stepn;
	stepn = point/500;
	return stepn;
} 

void zsw_test(){
	s_os = (*portInputRegister(port_os) & bit_os) ? true : false;
	while(!s_os){
		s_os = (*portInputRegister(port_os) & bit_os) ? true : false;
		delay(500);
	}
}
void move_origin(boolean isCount){
	long stepn = 0;
	howZ = 0;
	s_os = (*portInputRegister(port_os) & bit_os) ? true : false;
// Serial.println(s_os);
	if(!s_os){
		digitalWrite(ccw,DOWN);
		uint8_t port = digitalPinToPort(cw);
		volatile uint8_t *out= portOutputRegister(port);
		uint8_t bit_mask = digitalPinToBitMask(cw);
		while(!s_os){
			*out |= bit_mask;
			delayMicroseconds(1000);
			*out &= ~bit_mask;
			delayMicroseconds(1000);
			s_os = (*portInputRegister(port_os) & bit_os) ? true : false;
			if(isCount){
				curVal -= STEP_SIZE;
				howZ -= STEP_SIZE;
			}
		}
	}
}

void move_p_origin(boolean isCount){
	s_ls_p = (*portInputRegister(port_ls_p) & bit_ls_p) ? true : false;
	if(!s_ls_p){
		digitalWrite(ccw,DOWN);
		uint8_t port = digitalPinToPort(cw);
		volatile uint8_t *out= portOutputRegister(port);
		uint8_t bit_mask = digitalPinToBitMask(cw);
		while(!s_ls_p){
			*out |= bit_mask;
			delayMicroseconds(1000);
			*out &= ~bit_mask;
			delayMicroseconds(1000);
			s_ls_p = (*portInputRegister(port_ls_p) & bit_ls_p) ? true : false;
			if(isCount) curVal -= STEP_SIZE;
		}
	}
}

void move_m_origin(boolean isCount){
	s_ls_m = (*portInputRegister(port_ls_m) & bit_ls_m) ? true : false;
	if(!s_ls_m){
		digitalWrite(ccw,UP);
		uint8_t port = digitalPinToPort(cw);
		volatile uint8_t *out= portOutputRegister(port);
		uint8_t bit_mask = digitalPinToBitMask(cw);
		while(!s_ls_m){
			*out |= bit_mask;
			delayMicroseconds(1000);
			*out &= ~bit_mask;
			delayMicroseconds(1000);
			s_ls_m = (*portInputRegister(port_ls_m) & bit_ls_m) ? true : false;
			if(isCount) curVal += STEP_SIZE;
		}
	}
}

boolean sync(){
	int i = 0;
	int max = 100;
	while(true){
		if(Serial.available() && i < max){
			Serial.read();
			return true;
		} else if(i < max){
			i++;
			Serial.write(syncChar);
			delay(500);
		} else {
			return false;
		}
	}
}

long receiveData(){
	int buf[dataSize];
	long data = 0;
	int i = 0;
	while(i < dataSize){
		if(Serial.available() > 0){
			buf[i] = Serial.read();
			i++;
		}
	}
	//ビッグエンディアン
	for(int i = dataSize - 1; i > -1; i--){
		long tmp = (long)buf[i];
		data = data << 8;
		data = data | tmp;
	}
	return data;
}

boolean sendData(long data){
	// Serial.println(data);
	byte sendData[packetSize];
	long prefix = 0x000000ff;
	for(int i = 0; i < packetSize; i++){
		sendData[i] = (byte) (prefix & data);
		// Serial.print(sendData[i],HEX);
		Serial.write(sendData[i]);
		data = (unsigned long) data >> byteSize;
	}
	return true;
}

void laserPower(int ONorOFF){
	digitalWrite(laserPower_sw, ONorOFF);
}

void INA226_setup(){
	// I2Cの初期設定
  Wire.begin();
  // average: 16 times, conversion time: 8.244ms/8.244ms 
  INA226_write(INA226_CONFIG, 0x45ff);
  // current conversion
  INA226_write(INA226_CALIB,  2560);
}
void INA226_write(byte reg, unsigned short val)
{
  Wire.beginTransmission(INA226_ADDR);
  Wire.write(reg);
  Wire.write(val >> 8);
  Wire.write(val & 0xff);
  Wire.endTransmission();  
}

short INA226_read()
{
  short ret = 0;
  // request the registor
  Wire.beginTransmission(INA226_ADDR);
  Wire.write(INA226_BUSV);
  Wire.endTransmission();  
  // read
  Wire.requestFrom((int)INA226_ADDR, 2);
  while(Wire.available()) {
	ret = (ret << 8) | Wire.read();
  }
  return ret;
}

long volt2point(long micro_volt){
	long p;
	p = micro_volt / 50;
	p -= cor_val;
	return p;
}

long read_v(){
  return (long) INA226_read() * DEF_VAL * DEF_ADJ;
}
