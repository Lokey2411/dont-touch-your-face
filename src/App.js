import React, { useRef, useState } from "react";
import "./App.css";
import { Howl } from "howler";
import heySound from "./assets/hey_sondn.mp3";
import * as knnClassifier from "@tensorflow-models/knn-classifier";
import * as mobilenetModule from "@tensorflow-models/mobilenet";
import * as tf from "@tensorflow/tfjs";
import * as posenet from "@tensorflow-models/posenet";

const sound = new Howl({
	src: [heySound],
});

// sound.play();

const NOT_TOUCH_LABEL = "not_touch";
const TOUCH_LABEL = "touch";
const TRAINING_TIME = 200;
const ERROR_MESSAGE = "Bỏ tay ra đi. Thứ tôi muốn thấy là nụ cười của em";
const NUM_NEIGHBOR = 62;
let dataset = [];
function App() {
	const video = useRef();
	const mobilenet = useRef();
	const net = useRef();
	const progress = useRef();
	const classifier = knnClassifier.create();
	const [isTouch, setIsTouch] = useState(false);

	const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time));
	const training = (label) => {
		return new Promise(async (resolve) => {
			const embedding = mobilenet.current.infer(video.current, true);
			classifier.addExample(embedding, label);
			dataset = [...dataset, { image: video.current, label }];
			await sleep(100);
			resolve();
		});
	};
	const train = async (label) => {
		console.log(`[${label} đang check với gương mặt đẹp trai của bạn]`);
		for (let i = 0; i < TRAINING_TIME; i++) {
			console.log(`progress ${progress.current.value} %`);
			await training(label);
			progress.current.value = ((i + 1) * 100) / TRAINING_TIME;
			// setProgress(((i + 1) / TRAINING_TIME) * 100);
		}
		console.log("máy đã học xong");
	};
	const calculateAccuracy = async () => {
		if (dataset.length === 0) {
			//nếu chưa có dataset thì dừng hàm
			console.log("Chưa có dataset");
			return;
		}
		let numCorrect = 0;
		const numExample = dataset.length;
		for (let i = 0; i < numExample; i++) {
			const example = dataset[i];
			console.log(example);
			const embedding = mobilenet.current.infer(example.image, true);
			const result = await classifier.predictClass(embedding, NUM_NEIGHBOR).catch((error) => console.log(error));
			console.log(result);
			if (result.label === example.label) {
				numCorrect++;
			}
		}
		console.log(numCorrect);
		const accuracy = (numCorrect / numExample) * 100;
		console.log(`Với k = ${NUM_NEIGHBOR} , thuật toán có độ chính xác: ${accuracy.toFixed(2)}%`);
	};
	const drawImagePoint = async () => {
		const pose = await net.current.estimateSinglePose(video.current);
		const canvas = document.createElement("canvas");
		canvas.width = 360;
		canvas.height = 240;
		video.current.appendChild(canvas);
		const ctx = canvas.getContext("2d");
		ctx.drawImage(video.current, 0, 0, 360, 240);

		// Vẽ các điểm chính lên canvas
		pose.keypoints.forEach((keypoint) => {
			ctx.beginPath();
			ctx.arc(keypoint.position.x, keypoint.position.y, 10, 0, 2 * Math.PI);
			ctx.fillStyle = "red";
			ctx.fill();
		});
		console.log(pose.keypoints);
	};

	const run = async () => {
		const embedding = mobilenet.current.infer(video.current, true);
		const result = await classifier.predictClass(embedding, NUM_NEIGHBOR);
		await drawImagePoint();
		console.log(result.confidences);
		const isTouch = result.label === TOUCH_LABEL;
		setIsTouch(isTouch);
		if (isTouch) {
			sound.play();
		}
		await sleep(1000);
		run();
	};

	const setupCamera = async () => {
		return new Promise((resolve, reject) => {
			navigator.getUserMedia = navigator.getUserMedia || navigator.mozGetUserMedia || navigator.mediaDevices.getUserMedia || navigator.webkitGetUserMedia || navigator.msGetUserMedia;
			if (navigator.getUserMedia) {
				navigator.getUserMedia(
					{
						video: true,
					},
					(stream) => {
						video.current.srcObject = stream;
						video.current.addEventListener("loadeddata", resolve);
					},
					(error) => reject(error)
				);
			} else reject();
		});
	};
	const loadModel = async () => {
		try {
			tf.loadLayersModel();
			mobilenet.current = await mobilenetModule.load();
			net.current = await posenet.load();
			alert("thành công nhận diện");
			console.log("Cấm chạm tay lên mặt và bấm vào nút đầu tiên");
		} catch (error) {
			console.error(error);
		}
	};
	document.body.onload = async () => {
		console.log("init");
		setupCamera();
		loadModel();
	};
	return (
		<div className={`main ${isTouch && "touched"}`}>
			<video
				className="video"
				autoPlay
				ref={video}
				id="video"
			/>
			<div className="control">
				<button
					className="btn"
					onClick={async () => {
						await train(NOT_TOUCH_LABEL);
					}}
				>
					Không chạm lên mặt để app đọc chuyển động của bạn
				</button>
				<button
					className="btn"
					id="js-train-not-touch"
					onClick={async () => {
						await train(TOUCH_LABEL);
					}}
				>
					Chạm tay lên mặt để app đọc chuyển động của bạn
				</button>
				<button
					className="btn"
					id="js-run"
					onClick={() => {
						run().catch((error) => {
							alert("Máy chưa được học, hãy để cho máy học rồi mới chạy");
							console.log(error);
						});
					}}
				>
					Chạy ở đây
				</button>
				<button
					onClick={() => calculateAccuracy()}
					className="btn"
				>
					Lấy đọ chính xác
				</button>
			</div>
			{isTouch && (
				<div className="modal">
					<img
						src="./assets/warning.png"
						alt={ERROR_MESSAGE}
						id="error"
						style={{
							width: "20%",
						}}
					/>
				</div>
			)}
			<progress
				max="100"
				style={{
					height: 50,
					width: "20%",
					position: "absolute",
					bottom: 0,
				}}
				ref={progress}
			></progress>
		</div>
	);
}

export default App;
