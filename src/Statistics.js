
// Uncorrected Plane : 補正なし平面
// Ideal Plane : 理想平面 (xy平面)
// Ideal Summing Plane : 理想加算平面、最小二乗平面で求める 
// Ideal Corrected Plane : 理想補正平面
// Corrected Plane : 補正平面

class Statistics(){
	static getHoseiFunc(data){
		let abc = sumSamplingData(data);
		if(!data[0].howz || data[0].howz != 0){
			console.warning("一つ目のhowzの値が不正かもしれません。howz=" + data[0].howz);
		}
		if(!(abc[0] && abc[1] && abc[2] && abc[0] === 'number' && abc[1] === 'number' && abc[2] === 'number')){
			console.error("sumSamplingData Error:最小二乗平面の算出に失敗しました。");
			return new Error("sumSamplingData Error:最小二乗平面の算出に失敗しました。");
		}
		return (x,y) => {
			return -(abc[0] + abc[1] * x + abc[2] * y);
		}
	}

	static getFitFunc(data){
		let abc = sumSamplingData(data);
		if(!data[0].howz || data[0].howz != 0){
			console.warning("一つ目のhowzの値が不正かもしれません。howz=" + data[0].howz);
		}
		if(!(abc[0] && abc[1] && abc[2] && abc[0] === 'number' && abc[1] === 'number' && abc[2] === 'number')){
			console.error("sumSamplingData Error:最小二乗平面の算出に失敗しました。");
			return new Error("sumSamplingData Error:最小二乗平面の算出に失敗しました。");
		}
		return (x,y) => {
			return (abc[0] + abc[1] * x + abc[2] * y);
		}
	}
}

// let ob = sumSamplingData(data);
// console.log(ob);
// let a = ob[0];
// let b = ob[1];
// let c = ob[2];
// let resz = []

// data.map((d) => {
//     resz.push((a + b * d.x + c * d.y) - d.z);
//     // console.log();
// })

// console.log("Max:" + resz.reduce((p,c,i,a) => { 
//     return Math.max(p,c);
// }));
// console.log("Min:" + resz.reduce((p,c,i,a) => { 
//     return Math.min(p,c);
// }));

// console.log("Average:"+average(resz));
// console.log("Veriance:"+variance(resz));
// console.log("Standard Deviation:"+standard_deviation(resz));

function average(data)
{
    var sum = 0;
    for (i=0; i<data.length; i++) {
      sum = sum + data[i];
    }
    return (sum / data.length);
}
 
// * 分散を求める
function variance(data)
{
    // 平均値を求める
    var ave = average(data);
 
    var varia = 0;
    for (i=0; i<data.length; i++) {
        varia = varia + Math.pow(data[i] - ave, 2);
    }
    return (varia / data.length);
}
 
// 標準偏差を求める
function standard_deviation(data)
{
    // 分散を求める
    var varia = variance(data);
 
    // 分散の平方根
    return Math.sqrt(varia);
}

function sumSamplingData(data)
{
    // xの合計値
    let x = 0;

    // x^2の合計値
    let x2 = 0;

    // x * yの合計値
    let xy = 0;

    // x * zの合計値
    let xz = 0;

    // yの合計値
    let y = 0;

    // y^2の合計値
    let y2 = 0;

    // y * zの合計値
    let yz = 0;

    // zの合計値
    let z = 0;

    // 計測したデータから、各種必要なsumを得る
    for (let i = 0; i < data.length; i++)
    {
        let v = data[i];
        // console.log(v);
        // 最小二乗平面との誤差は高さの差を計算するので、（今回の式の都合上）Yの値をZに入れて計算する
        let vx = v.x;
        let vy = v.y;
        let vz = v.z;

        x += vx;
        x2 += (vx * vx);
        xy += (vx * vy);
        xz += (vx * vz);

        y += vy;
        y2 += (vy * vy);
        yz += (vy * vz);

        z += vz;
    }

    // matA[0, 0]要素は要素数と同じ（\sum{1}のため）
    let l = 1 * data.length;

    // 求めた和を行列の要素として2次元配列を生成
    let matA = [
        [l,  x,  y],
        [x, x2, xy],
        [y, xy, y2],
    ];

    let b = [ z, xz, yz ];
    // console.log(matA);
    // console.log(b);
    // 求めた値を使ってLU分解→結果を求める
    return LUDecomposition(matA, b);
}

function LUDecomposition(matA, b){
    let N = matA.length;

    // 分解した下三角行列L用バッファ
    let matL = [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
    ];

    // 分解した上三角行列U用バッファ
    let matU = [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
    ];

    // 分解後に利用するバッファ用行列
    let lu = [
        [0, 0, 0, 0], 
        [0, 0, 0, 0], 
        [0, 0, 0, 0], 
        [0, 0, 0, 0], 
    ];

    for (let i = 0; i < N; i++) {

        let n = N - i - 1;

        // l0_0成分をコピー
        let l0 = matL[i][i] = matA[0][0];

        // l1成分をコピー
        let l1 = [];
        for (let j = 0; j < n; j++) {
            matL[j + i + 1][i] = l1[j] = matA[j + 1][0];
        }

        // →u1^T成分をコピー
        let u1 = [];
        for (let j = 0; j < n; j++) {
            matU[i][j + i + 1] = u1[j] = matA[0][j + 1] / l0;
        }

        // luを求める
        for (let j = 0; j < n; j++) {
            for (let k = 0; k < n; k++) {
                lu[j][k] = l1[j] * u1[k];
            }
        }

        // A1を求める（n-1行列）
        let A1 = [];
        for (let j = 0; j < n; j++) {
            A1[j] = [];
            for (let k = 0; k < n; k++) {
                A1[j][k] = matA[j + 1][k + 1] - lu[j][k];
            }
        }

        // A1を改めてmatAとして再帰的に解く
        matA = A1;
    }

    // 求めたLU行列を使って連立方程式を解く
    let y = new Array(N);
    for (let i = 0; i < N; i++) {
        let sum = 0;
        for (let k = 0; k <= i - 1; k++) {
            sum += matL[i][k] * y[k];
        }
        y[i] = (b[i] - sum) / matL[i][i];
    }

    let x = new Array(N);
    for (let i = N - 1; i >= 0; i--) {
        let sum = 0;
        for (let k = i + 1; k <= N - 1; k++) {
            sum += matU[i][k] * x[k];
        }
        x[i] = y[i] - sum;
    }

    return x;
}
