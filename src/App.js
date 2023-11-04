import React, { useRef, useState } from "react";
import "./App.css";
import { Howl } from "howler";
import heySound from "./assets/hey_sondn.mp3";
import * as knnClassifier from "@tensorflow-models/knn-classifier";
import * as mobilenetModule from "@tensorflow-models/mobilenet";
import * as tf from "@tensorflow/tfjs";
import * as posenet from "@tensorflow-models/posenet";
import JSZip from "jszip";
import { saveAs } from "file-saver";

const sound = new Howl({
  src: [heySound],
});
//Các lớp
const NOT_TOUCH_LABEL = "not_touch";
const TOUCH_LABEL = "touch";
const classes = [NOT_TOUCH_LABEL, TOUCH_LABEL];
const TRAINING_TIME = 200; //số lần training
const ERROR_MESSAGE = "Bỏ tay ra đi. Thứ tôi muốn thấy là nụ cười của em";
const NUM_NEIGHBOR = 62; //số lượng điểm gần nhất
let dataset = {
  [NOT_TOUCH_LABEL]: [], //Mảng lưu các hình có nhãn "not_touch"
  [TOUCH_LABEL]: [], //Mảng lưu các hình có nhãn "touch"
  length: 0, //số phần tử của mảng tổng
  data: [], //mảng tổng
};

function App() {
  const video = useRef();
  const mobilenet = useRef();
  const net = useRef();
  const progress = useRef();
  const classifier = knnClassifier.create();
  const [isTouch, setIsTouch] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isAdding, setIsAdding] = useState(false); //Ẩn hiện các nút thêm ví dụ
  //Viết vào thẻ có id "js-classifier"
  const writeClassifierResult = (label) => {
    document.getElementById("js-classifier").innerText = label;
  };
  //Thêm và xác minh các hình được thêm vào
  const handleAddAvailImage = async (event) => {
    // alert(dataset);
    if (dataset.length === 0) {
      alert("Máy chưa có dữ liệu. Yêu cầu thêm dữ liệu");
      return;
    }
    const file = event.target.files[0];
    if (!file) {
      alert("Vui lòng thêm file");
      writeClassifierResult("Vui lòng thêm file");
      return;
    }
    //Xác minh file ảnh
    const validFileTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (!validFileTypes.includes(file.type)) {
      alert("Chỉ chấp nhận file .png, .jpg hoặc .jpeg");
      writeClassifierResult("Không Chấp nhận file");
      return;
    }
    //ghi file qua reader
    const reader = new FileReader(); //khai báo reader
    const image = document.createElement("img"); //Tạo ra thẻ img để xác minh
    image.width = 360;
    image.height = 240;
    //Xử lý lỗi
    reader.onerror = (error) => {
      alert(error);
      writeClassifierResult("");
    };
    reader.onloadend = () => {
      image.src = reader.result; //Sau khi load xong thi lưu cái kết quả vô cái image.src
      image.onload = async () => {
        const embedding = mobilenet.current.infer(image, true); // infer cái ảnh ra
        const result = await classifier
          .predictClass(embedding, NUM_NEIGHBOR)
          .catch(() => {
            writeClassifierResult("Máy không thể xác định"); //Nếu có lỗi
          });
        console.log(result); //Debug
        writeClassifierResult(
          "Máy đã xác định: Hình ảnh bạn đã đưa ra thuộc lớp " + result.label
        ); //Viết vô trong cái box
      };
    };
    //Gọi reader
    reader.readAsDataURL(file);
  };

  const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time));
  //Lưu ảnh chụp màn
  const captureImage = (video) => {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  };
  //Tải file zip về
  const downloadImages = async (images, label, event) => {
    event.preventDefault();
    const zip = new JSZip();
    //Cho các ảnh vô file zip
    images.forEach((image, index) => {
      const imgData = image.split(",")[1];
      zip.file(`image_${index}.png`, imgData, { base64: true });
    });
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `training_${label}.zip`);
  };

  const training = (label) => {
    return new Promise(async (resolve) => {
      const image = captureImage(video.current); // Chụp ảnh từ video, lưu vô file zip
      dataset[label] = [...dataset[label], { image, label }]; // Lưu ảnh vô dataset[label] để phân biệt giữa dataset của touch và not_touch
      dataset.length++; // + số phần tử của dataset
      await sleep(100); //dừng khoảng 0.1s sau khi làm xong
      resolve();
    });
  };

  const train = async (label) => {
    console.log(`[${label} đang check với gương mặt đẹp trai của bạn]`);
    for (let i = 0; i < TRAINING_TIME; i++) {
      console.log(`progress ${progress.current.value} %`); //console log cái tiến trình
      await training(label);
      progress.current.value = ((i + 1) * 100) / TRAINING_TIME;
    }
    console.log("máy đã học xong");
    //Thêm vào dataset
    dataset.data = [...dataset[NOT_TOUCH_LABEL], ...dataset[TOUCH_LABEL]];
    const images = dataset[label].map((data) => data.image); //Lấy về các hình ảnh của lớp label
    //Download về
    const downloadLink = document.createElement("button"); // tạo ra NodeElement button
    downloadLink.onclick = (event) => downloadImages(images, label, event); //lấy hàm onClick xử lý sự kiện gọi hàm downloadImages
    //gọi hàm onClick
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };
  //Thêm các ví dụ thông qua các button
  const addExampleData = async (data, label) => {
    console.log(data);
    console.log(`[${label} đang check với gương mặt đẹp trai của bạn]`);
    if (!data) {
      //Nếu không có data
      alert("Vui lòng thêm dữ liệu");
      return;
    }
    const numData = data.length;
    for (let i = 0; i < numData; i++) {
      const file = data[i];
      //Đọc file như thằng ở trên
      const reader = new FileReader();
      const image = document.createElement("img");
      reader.onloadend = () => {
        image.src = reader.result;
        image.onload = async () => {
          const embedding = mobilenet.current.infer(image, true);
          progress.current.value = ((i + 1) * 100) / numData;
          classifier.addExample(embedding, label); // Thêm ví dụ vào trong dataset
          dataset[label] = [...dataset[label], { image, label }]; // Thêm ví dụ vào trong dataset
          dataset.length++;
        };
      };
      reader.readAsDataURL(file);
      await sleep(100);
    }
    dataset.data = [...dataset[NOT_TOUCH_LABEL], ...dataset[TOUCH_LABEL]];
  };
  const calculateAccuracy = async () => {
    if (dataset.data.length === 0) {
      //nếu chưa có dataset thì dừng hàm
      console.log("Chưa có dataset");
      return;
    }
    let statistic = {
      numCorrect: 0, //Số lần đúng
      numTouch: 0, //Số lần chạm vô mặt
      numCorrectTouch: 0, //Số lần chạm vô mặt và đúng
    };
    const numExample = dataset.data.length;
    for (let i = 0; i < numExample; i++) {
      progress.current.value = ((i + 1) / numExample) * 100; //update tiến trình
      const example = dataset.data[i]; //lấy về dataset
      console.log(example);
      const embedding = mobilenet.current.infer(example.image, true);
      const result = await classifier.predictClass(embedding, NUM_NEIGHBOR); //dự đoán nhãn của ví dụ
      console.log(result);
      const isTrueCase = result.label === example.label; //nếu đây là trường hợp đúng
      const isTouchCase = result.label === TOUCH_LABEL; //nếu đây là trường hợp chạm vào mặt
      if (isTrueCase) {
        //Nếu đúng thì cộng lên số lần đúng
        statistic.numCorrect++;
      }
      if (isTouchCase) {
        //Nếu đây là trường hợp chạm vào mặt. Đúng thì + cái numCorrectTouch
        if (isTrueCase) statistic.numCorrectTouch++;
        statistic.numTouch++;
      }
    }
    console.log(statistic.numCorrect);
    const accuracy = (statistic.numCorrect / numExample) * 100; // accuracy
    const sensitivity = (statistic.numTouch / numExample) * 100; // recall của touch, của not_touch là 100 - touch
    const specificityTouch =
      (statistic.numCorrectTouch / statistic.numTouch) * 100; //recall của lớp touch
    const specificityNotTouch =
      ((statistic.numCorrect - statistic.numCorrectTouch) /
        (numExample - statistic.numTouch)) *
      100;
    // lấy số lần đúng của not_touch chia cho số lần not_touch
    const p = document.createElement("p"); //Tạo ra thẻ chứa các thông số
    p.className = "statistic"; // class của thẻ này là statistic
    p.innerHTML = `
		Các thông số hiện tại:<br/>
		Accuracy : ${accuracy.toFixed(2)}%,<br/>
		Recall: ${sensitivity}% với lớp ${TOUCH_LABEL} , ${
      100 - sensitivity
    }% với lớp ${NOT_TOUCH_LABEL},<br/>
		Precision : ${specificityTouch}% với lớp ${TOUCH_LABEL}, ${specificityNotTouch}% với lớp ${NOT_TOUCH_LABEL},
      `; //Ghi ra thẻ p kia

    document.body.appendChild(p); // Thêm vào trong document
  };
  //Ghi các điểm ảnh lên console
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
    if (isRunning) return;
    const embedding = mobilenet.current.infer(video.current, true); // mô hình hóa hình ảnh của camera
    const result = await classifier.predictClass(embedding, NUM_NEIGHBOR); // dự đoán nhãn của hình ảnh
    await drawImagePoint().catch((error) => console.log(error)); // Lấy các hình ảnh
    console.log(result.confidences);
    const isTouch = result.label === TOUCH_LABEL;
    setIsTouch(isTouch);
    if (isTouch) {
      sound.play(); // Nếu nhãn là chạm thì mở âm thanh
    }
    await sleep(1000); // Đợi 1s sau mới dự đoán
    run();
  };

  const setupCamera = async () => {
    return new Promise((resolve, reject) => {
      navigator.getUserMedia =
        navigator.getUserMedia ||
        navigator.mozGetUserMedia ||
        navigator.mediaDevices.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.msGetUserMedia; // Lấy về camera
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
  //Tải các model
  const loadModel = async () => {
    try {
      tf.loadLayersModel();
      mobilenet.current = await mobilenetModule.load(); //tải mobilenet
      net.current = await posenet.load(); //tải posenet
      alert("thành công tải các mô hình");
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
      <video className="video" autoPlay ref={video} id="video" />
      <div className="control">
        <button
          className="btn addData"
          onClick={() => {
            setIsAdding((prevState) => !prevState); //toggle thằng adding
          }}
        >
          Thêm các dataset có sẵn
          <div
            className="classes"
            style={{
              display: isAdding ? "block" : "none", //nếu isAdding là true thì hiện còn không thì ẩn
            }}
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            Chọn nhãn của dữ liệu:
            {classes.map((label) => (
              <button
                key={label}
                style={{ borderRadius: 16, marginLeft: 8, padding: 4 }}
                onClick={(event) => {
                  //Tải các dữ liệu về khi bấm vô
                  event.preventDefault();
                  const uploadImage = document.createElement("input");
                  uploadImage.type = "file";
                  uploadImage.multiple = true;
                  uploadImage.onchange = (e) => {
                    if (!e.target || !e.target.files[0]) {
                      alert("Bạn chưa thêm dữ liệu");
                      return;
                    }
                    const numFiles = e.target.files.length;
                    for (let i = 0; i < numFiles; i++) {
                      const file = e.target.files[i];
                      const validFileTypes = [
                        "image/jpeg",
                        "image/png",
                        "image/jpg",
                      ];
                      if (!validFileTypes.includes(file.type)) {
                        alert("Chỉ chấp nhận file .png, .jpg hoặc .jpeg");
                        return;
                      }
                    }
                    addExampleData(e.target.files, label);
                  };
                  document.body.appendChild(uploadImage);
                  uploadImage.click();
                  document.body.removeChild(uploadImage);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </button>
        <button
          className="btn"
          onClick={async () => {
            await train(NOT_TOUCH_LABEL);
          }}
        >
          Huấn luyện mô hình chuyển động không chạm lên mặt
        </button>
        <button
          className="btn"
          id="js-train-not-touch"
          onClick={async () => {
            await train(TOUCH_LABEL);
          }}
        >
          Huấn luyện mô hình chuyển động chạm mặt
        </button>
        <button
          className="btn"
          id="js-run"
          onClick={() => {
            setIsRunning(true);
            run().catch((error) => {
              alert("Máy chưa có dữ liệu. Hãy thêm dữ liệu vào máy");
              console.log(error);
            });
          }}
        >
          Chạy ở đây
        </button>
        <button onClick={() => calculateAccuracy()} className="btn">
          Lấy các thông số
          <br />
          DEVELOPER ONLY
        </button>
        <button onClick={() => setIsRunning(false)} className="stop">
          Dừng chương trình và xóa toàn bộ dữ liệu
        </button>

        <div className="add-image">
          <p className="add-image-title">Thêm hình ảnh bạn muốn classify</p>
          <input
            type="file"
            placeholder="Thêm hình ảnh bạn muốn classify"
            onChange={handleAddAvailImage}
            className="input"
          />
          <p id="js-classifier"></p>
        </div>
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
          // position: "absolute",
          bottom: 0,
        }}
        ref={progress}
      ></progress>
    </div>
  );
}

export default App;
