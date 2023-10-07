import React, { useRef, useState } from "react";
import "./App.css";
import { Howl } from "howler";
import heySound from "./assets/hey_sondn.mp3";
import * as knnClassifier from "@tensorflow-models/knn-classifier";
import * as mobilenetModule from "@tensorflow-models/mobilenet";
import * as tf from "@tensorflow/tfjs";

const sound = new Howl({
	src: [heySound],
});

// sound.play();

const NOT_TOUCH_LABEL = "not_touch";
const TOUCH_LABEL = "touch";
const TRAINING_TIME = 50;
const TOUCH_CONFIDENCE = 0.8;
const ERROR_MESSAGE = "Bỏ tay ra đi. Thứ tôi muốn thấy là nụ cười của em";
let dataset = [];
function App() {
	const video = useRef();
	const mobilenet = useRef();
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
			console.log(`progress ${progress.current.value} * 100}%`);
			await training(label);
			progress.current.value = ((i + 1) * 100) / TRAINING_TIME;
			// setProgress(((i + 1) / TRAINING_TIME) * 100);
		}
		console.log("máy đã học xong");
	};
	const calculateAccuracy = async () => {
		if (dataset.length === 0) {
			console.log("Chưa có dataset");
			return;
		}
		let numCorrect = 0;
		for (let i = 0; i < dataset.length; i++) {
			const example = dataset[i];
			const embedding = mobilenet.current.infer(example.image, true);
			const result = await classifier.predictClass(embedding).catch((error) => console.log(error));
			if (result.label === example.label) {
				numCorrect++;
			}
		}
		console.log(numCorrect);
		const accuracy = (numCorrect / dataset.length) * 100;
		console.log(`Độ chính xác: ${accuracy.toFixed(2)}%`);
	};
	const run = async () => {
		const embedding = mobilenet.current.infer(video.current, true);
		const result = await classifier.predictClass(embedding);
		console.log(result.confidences);
		const isTouch = result.label === TOUCH_LABEL;
		setIsTouch(isTouch);
		if (isTouch) {
			sound.play();
		}
		await sleep(2000);
		await run();
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
			alert("thành công nhận diện");
			console.log("Cấm chạm tay lên mặt và bấm vào nút đầu tiên");
		} catch (error) {
			console.error(error);
		}
	};
	document.body.onload = async () => {
		console.log("init");
		setupCamera()
			.then(async () => {
				await loadModel();
			})
			.catch((error) => console.log(error));
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
