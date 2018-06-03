/*
 * Arduino UNO
 * 使用ピン analog: なし, digital:2,3,8,9,10,11,12,13
*/
#include <SPI.h>
// ピン定義:モータドライバ
#define PIN_SPI_MOSI 11
#define PIN_SPI_MISO 12
#define PIN_SPI_SCK 13
#define PIN_SPI_SS 10
#define PIN_BUSY 9
#define PIN_SW 8
#define MAX_REP 10

//ピン定義:リニアエンコーダ
#define PIN_A 3
#define PIN_B 2

// リニアエンコーダ用変数
// volatileは割り込み関数で変数をいじるために必要
volatile int s_a = false;  //aの状態(1 or -1)
volatile int s_b = false;  //bの状態(1 or -1)
// volatile int disp = 0; //リニアエンコーダ距離
const int unit = 5000;
uint8_t bit_a, bit_b, port_a, port_b; // digitalReadの初期設定
volatile int errCount = 0;

//プロッター変数
#define dataSize 4
#define byteSize 8
#define packetSize 4
#define amp 128
const long DATA_RATE = 115200;
char syncChar = 'y';
int c = -1;
char state = 'n';
long tarVal = 0;
volatile long curVal = 0;
long moveby = 100000;
long errCriteria = -1;

int sppPin = 5; //seting position pointer

void setup() {
	delay(1000); //よくわからないが必要

	pinMode(sppPin, OUTPUT);
	digitalWrite(sppPin, LOW);

	//ドライバ通信 SPI用ピン設定
	pinMode(PIN_SPI_MOSI, OUTPUT);
	pinMode(PIN_SPI_MISO, INPUT);
	pinMode(PIN_SPI_SCK, OUTPUT);
	pinMode(PIN_SPI_SS, OUTPUT);
	pinMode(PIN_BUSY, INPUT);
	pinMode(PIN_SW, INPUT);
	SPI.begin();
	SPI.setDataMode(SPI_MODE3);
	SPI.setBitOrder(MSBFIRST);
	digitalWrite(PIN_SPI_SS, HIGH);
   
	//リニアエンコーダ用割り込みピン(Arduino UNOの場合2,3番pin)
	pinMode(PIN_B, INPUT);
	pinMode(PIN_A, INPUT);

	L6470_setup(); //L6470を設定
	LinerEncoder_setup(); //リニアエンコーダを設定

	Serial.begin(DATA_RATE);
	while (!Serial) {}

	if(sync()){
			//success
		}else{
			//error
		}
	
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
		case 'e':
			changeState('e');
			break;
		case 'n':
			changeState('n');
			break;
//////////////////////////////////////
		case 'k':
			changeState('k');
			errCriteria = receiveData();
			break;
		case 'l':
			changeState('l');
			sendData(errCriteria);
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
		case 'u':
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
///////////////////////////////////////
		case 'E':
			changeState('E');
			sendData(errCount);
			break;
///////////////////////////////////////
		case 'G':
			changeState('G');
			digitalWrite(sppPin, HIGH);
			break;
		case 'H':
			changeState('H');
			digitalWrite(sppPin, LOW);
			break;
///////////////////////////////////////
		case 'P':
			changeState('P');
			zeroSeekTest();
			break;
		case 'Q':
			changeState('Q');
			zeroSeekX();
			break;
		case 'R':
			changeState('R');
			zeroSeekY();
			break;
		case 'S':
			changeState('S');
			xyMoveTarVal();
			break;
		case 'T':
			changeState('T');
			move(moveby);
			break;
		case 'U':
			changeState('U');
			move(2500);
			break;
		case 'V':
			changeState('V');
			move(1000000);
			break;
		case 'W':
			changeState('W');
			move(100000);
			break;
//////////////////////////////////////
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

void zeroSeekTest(){
	L6470_gountil(0,1,0x001); //右回転
	while(isActive()){}
}
void zeroSeekX(){
	L6470_gountil(0,0,0xfff); //左回転
	while(isActive()){}
}

void zeroSeekY(){
	L6470_gountil(0,1,0xfff); //右回転
	while(isActive()){}    
}

void xyMoveTarVal(){
	for(int i = 0; i < MAX_REP; i++){
		long pointDiff = tarVal - curVal;
		if(abs(pointDiff) > errCriteria) {
			move(pointDiff);
			if(errCriteria == -1) break;
		}
	}
}

void move(long point){
	long stepn = 0;
	if(point > 0){ //左回転
		stepn = point2step(point);
		_move(0,stepn);
	} else { //右回転
		stepn = point2step(-point);
		_move(1,stepn);
	}
}

void _move(int dia,long stepn){
	if( stepn > 4194303){
		L6470_move(dia,4194303);
		while(isActive()){}
		_move(dia,stepn - 4194303);
	} else {
		L6470_move(dia,stepn);
		while(isActive()){}
	}
}

long point2step(long point){
	long stepn = (point + 1250)/2500;
	stepn *= 64;
	return stepn;
}

boolean isActive() {
	if ((L6470_getparam_status() & 0x0060) == 0) 
	  return false;
	else 
	  return true;
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
	// ビッグエンディアン
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

void L6470_setup() {
	delay(1000); //魔法のdelay
	L6470_resetdevice(); //L6470のリセット 中身はNOPの連打
	L6470_setparam_acc(0x60); //[R, WS] 加速度default 0x08A (12bit) (14.55*val+14.55[step/s^2])
	L6470_setparam_dec(0x60); //[R, WS] 減速度default 0x08A (12bit) (14.55*val+14.55[step/s^2])
	L6470_setparam_maxspeed(0x40); //[R, WR]最大速度default 0x041 (10bit) (15.25*val+15.25[step/s])
	L6470_setparam_minspeed(0x01); //[R, WS]最小速度default 0x000 (1+12bit) (0.238*val[step/s])
	L6470_setparam_fsspd(0x3ff); //[R, WR]μステップからフルステップへの切替点速度default 0x027 (10bit) (15.25*val+7.63[step/s])
	L6470_setparam_kvalhold(0x0); //[R, WR]停止時励磁電圧default 0x29 (8bit) (Vs[V]*val/256)
	L6470_setparam_kvalrun(0x50); //[R, WR]定速回転時励磁電圧default 0x29 (8bit) (Vs[V]*val/256)
	L6470_setparam_kvalacc(0x50); //[R, WR]加速時励磁電圧default 0x29 (8bit) (Vs[V]*val/256)
	L6470_setparam_kvaldec(0x20); //[R, WR]減速時励磁電圧default 0x29 (8bit) (Vs[V]*val/256)
	L6470_setparam_stepmood(0x07); //ステップモードdefault 0x07 (1+3+1+3bit)
}

void LinerEncoder_setup(){
	// digitalReadの初期設定
	bit_a = digitalPinToBitMask(PIN_A);
	port_a = digitalPinToPort(PIN_A);
	bit_b = digitalPinToBitMask(PIN_B);
	port_b = digitalPinToPort(PIN_B);

	// 状態の初期入力
	s_a = (*portInputRegister(port_a) & bit_a) ? 1 : 0;
	s_b = (*portInputRegister(port_b) & bit_b) ? 1 : 0;

	// 割り込み関数(interrupptf)の追加
	attachInterrupt(0,interrupptf,CHANGE);
	attachInterrupt(1,interrupptf,CHANGE);
}

void interrupptf() {
	// a,bピンのHIGH,LOWを読み込み
	int a = (*portInputRegister(port_a) & bit_a) ? 1 : 0;
	int b = (*portInputRegister(port_b) & bit_b) ? 1 : 0;
	// 状態遷移を確かめるためのc,dを計算
	int c = s_a ^ b;
	int d = s_b ^ a;
	// 状態遷移から移動量を算出, errCountは不正な遷移の個数を記録
	if(c && !d) curVal -= unit;
	else if(d && !c) curVal += unit;
	else errCount++;
	// 次の状態遷移を求めるために、現在の状態を保存
	s_a = a;
	s_b = b;
}

// for debug
void fulash() {
	long status = L6470_getparam_status();
	Serial.print("0x");
	Serial.print(L6470_getparam_abspos(), HEX);
	Serial.print("  ");
	Serial.print("0x");
	Serial.print(L6470_getparam_speed(), HEX);
	Serial.print(" isStop:");
	Serial.print((L6470_getparam_status() & 0x0060) == 0);
	Serial.print(" status 0x");
	Serial.println(status & 0x0060);
}
