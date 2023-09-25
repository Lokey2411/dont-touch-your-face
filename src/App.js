import React, { useEffect, useRef, useState } from "react";
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

function App() {
	const video = useRef();
	const mobilenet = useRef();
	const classifier = knnClassifier.create();
	const [isTouch, setIsTouch] = useState(false);
	const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time));
	const training = (label) => {
		return new Promise(async (resolve) => {
			const embedding = mobilenet.current.infer(video.current, true);
			classifier.addExample(embedding, label);
			await sleep(100);
			resolve();
		});
	};
	const train = async (label) => {
		console.log(`[${label} đang check với gương mặt đẹp trai của bạn]`);
		for (let i = 0; i < TRAINING_TIME; i++) {
			console.log(`progress ${((i + 1) / TRAINING_TIME) * 100}%`);
			await training(label);
		}
	};
	const run = async () => {
		const embedding = mobilenet.current.infer(video.current, true);

		const result = await classifier.predictClass(embedding);
		console.log("label:", result.label);
		if (result.label === TOUCH_LABEL && result.confidences && result.confidences[result.label] > TOUCH_CONFIDENCE) {
			setIsTouch(true);
			sound.play();
		} else {
			setIsTouch(false);
		}
		await sleep(200);
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
			console.log("setup done");
			console.log("Cấm chạm tay lên mặt và bấm train1");
		} catch (error) {
			console.error("Error loading model or Mobilenet:", error);
		}
	};

	useEffect(() => {
		//clean up
		const initApp = async () => {
			console.log("init");
			setupCamera()
				.then(async () => {
					await loadModel();
				})
				.catch((error) => console.log(error));
		};
		return initApp;
	});
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
					Don't touch your face and click here to make app can learn
				</button>
				<button
					className="btn"
					id="js-train-not-touch"
					onClick={async () => {
						await train(TOUCH_LABEL);
					}}
				>
					Touch your face and click here to make app can learn
				</button>
				<button
					className="btn"
					id="js-run"
					onClick={() => {
						run();
					}}
				>
					Now you can run here
				</button>
			</div>
			{isTouch && (
				<img
					src="./assets/warning.png"
					alt={ERROR_MESSAGE}
				/>
			)}
		</div>
	);
}

export default App;
