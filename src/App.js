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

function App() {
  const video = useRef();
  const mobilenet = useRef();
  const progress = useRef();
  const classifier = knnClassifier.create();
  const [isTouch, setIsTouch] = useState(false);

  const testAccuracy = async (video) => {
    // Tạo tập dữ liệu kiểm tra
    const testDataset = [
      // Video không chạm tay lên mặt
      {
        label: NOT_TOUCH_LABEL,
        video: await tf.io.readFile("./data/not_touch.mp4"),
      },
      // Video chạm tay lên mặt
      {
        label: TOUCH_LABEL,
        video: await tf.io.readFile("./data/touch.mp4"),
      },
    ];

    // Dự đoán kết quả cho tập dữ liệu kiểm tra
    const predictions = await classifier.predict(testDataset);

    // Tính toán độ chính xác
    const accuracy =
      predictions
        .map((prediction) => {
          return prediction.label === prediction.data.label;
        })
        .reduce((sum, prediction) => sum + prediction, 0) / predictions.length;

    return accuracy;
  };
  F;

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
      console.log(`progress ${progress.current.value} * 100}%`);
      await training(label);
      progress.current.value = ((i + 1) * 100) / TRAINING_TIME;
      // setProgress(((i + 1) / TRAINING_TIME) * 100);
    }
    if (label === TOUCH_LABEL) {
      console.log(label === TOUCH_LABEL);
    } else if (label === NOT_TOUCH_LABEL) {
    }
    console.log("máy đã học xong");
  };
  const run = async () => {
    const embedding = mobilenet.current.infer(video.current, true);

    const result = await classifier.predictClass(embedding);
    console.log("label:", result.label);
    const accuracy = await testAccuracy(video.current);
    console.log("Accuracy:", accuracy);
    const isTouch =
      result.label === TOUCH_LABEL &&
      result.confidences &&
      result.confidences[result.label] > TOUCH_CONFIDENCE;
    setIsTouch(isTouch);
    if (isTouch) {
      // showModal("error");
      sound.play();
    }

    await sleep(1000);
    await run();
  };
  const setupCamera = async () => {
    return new Promise((resolve, reject) => {
      navigator.getUserMedia =
        navigator.getUserMedia ||
        navigator.mozGetUserMedia ||
        navigator.mediaDevices.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.msGetUserMedia;
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
      <video className="video" autoPlay ref={video} id="video" />
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
        }}
        ref={progress}
      ></progress>
    </div>
  );
}

export default App;
