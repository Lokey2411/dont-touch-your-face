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


const NOT_TOUCH_LABEL = "not_touch";
const TOUCH_LABEL = "touch";
const classes = [NOT_TOUCH_LABEL, TOUCH_LABEL];
const TRAINING_TIME = 200;
const ERROR_MESSAGE = "Bỏ tay ra đi. Thứ tôi muốn thấy là nụ cười của em";
const NUM_NEIGHBOR = 62;
let dataset = {
    [NOT_TOUCH_LABEL]: [],
    [TOUCH_LABEL]: [],
    length: 0,
    data: [],
};


function App() {
    const video = useRef();
    const mobilenet = useRef();
    const net = useRef();
    const progress = useRef();
    const classifier = knnClassifier.create();
    const [isTouch, setIsTouch] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const writeClassifierResult = (label) => {
        document.getElementById("js-classifier").innerText = label;
    };
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
        const validFileTypes = ["image/jpeg", "image/png", "image/jpg"];
        if (!validFileTypes.includes(file.type)) {
            alert("Chỉ chấp nhận file .png, .jpg hoặc .jpeg");
            writeClassifierResult("Không Chấp nhận file");
            return;
        }
        const reader = new FileReader();
        const image = document.createElement("img");
        image.width = 360;
        image.height = 240;
        reader.onerror = (error) => {
            alert(error);
            writeClassifierResult("");
        };
        reader.onloadend = () => {
            image.src = reader.result;
            image.onload = async () => {
                const embedding = mobilenet.current.infer(image, true);
                const result = await classifier.predictClass(embedding, NUM_NEIGHBOR).catch(() => {
                    writeClassifierResult("Máy không thể xác định");
                });
                console.log(result);
                writeClassifierResult("Máy đã xác định: Hình ảnh bạn đã đưa ra thuộc lớp " + result.label);
            };
        };


        reader.readAsDataURL(file);
    };


    const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time));
    const captureImage = (video) => {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/png");
    };


    const downloadImages = async (images, label, event) => {
        event.preventDefault();
        const zip = new JSZip();
        images.forEach((image, index) => {
            const imgData = image.split(",")[1];
            zip.file(`image_${index}.png`, imgData, { base64: true });
        });
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, `training_${label}.zip`);
    };


    // Trong hàm training của bạn:
    const training = (label) => {
        return new Promise(async (resolve) => {
            const image = captureImage(video.current); // Chụp ảnh từ video
            dataset[label] = [...dataset[label], { image, label }]; // Lưu ảnh thay vì toàn bộ video
            dataset.length++;
            await sleep(100);
            resolve();
        });
    };


    const train = async (label) => {
        console.log(`[${label} đang check với gương mặt đẹp trai của bạn]`);
        for (let i = 0; i < TRAINING_TIME; i++) {
            console.log(`progress ${progress.current.value} %`);
            await training(label, i);
            progress.current.value = ((i + 1) * 100) / TRAINING_TIME;
            // setProgress(((i + 1) / TRAINING_TIME) * 100);
        }
        console.log("máy đã học xong");
        dataset.data = [...dataset[NOT_TOUCH_LABEL], ...dataset[TOUCH_LABEL]];
        const images = dataset[label].map((data) => data.image);
        const downloadLink = document.createElement("button");
        downloadLink.onclick = (event) => downloadImages(images, label, event);
        downloadLink.innerText = "Download Dataset";
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    };
    const addExampleData = async (data, label) => {
        console.log(data);
        console.log(`[${label} đang check với gương mặt đẹp trai của bạn]`);
        if (!data) {
            alert("Vui lòng thêm dữ liệu");
            return;
        }
        const numData = data.length;
        for (let i = 0; i < numData; i++) {
            const file = data[i];
            const reader = new FileReader();
            const image = document.createElement("img");
            reader.onloadend = () => {
                image.src = reader.result;
                image.onload = async () => {
                    const embedding = mobilenet.current.infer(image, true);
                    progress.current.value = ((i + 1) * 100) / numData;
                    classifier.addExample(embedding, label);
                    dataset[label] = [...dataset[label], { image, label }];
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
            numCorrect: 0,
            numTouch: 0,
            numCorrectTouch: 0,
        };
        const numExample = dataset.data.length;
        for (let i = 0; i < numExample; i++) {
            progress.current.value = ((i + 1) / numExample) * 100;
            const example = dataset.data[i];
            console.log(example);
            const embedding = mobilenet.current.infer(example.image, true);
            const result = await classifier.predictClass(embedding, NUM_NEIGHBOR);
            console.log(result);
            const isTrueCase = result.label === example.label;
            const isTouchCase = result.label === TOUCH_LABEL;
            if (isTrueCase) {
                statistic.numCorrect++;
            }
            if (isTouchCase) {
                if (isTrueCase) statistic.numCorrectTouch++;
                statistic.numTouch++;
            }
        }
        console.log(statistic.numCorrect);
        const accuracy = (statistic.numCorrect / numExample) * 100;
        const sensitivity = (statistic.numTouch / numExample) * 100;
        const specificityTouch = (statistic.numCorrectTouch / statistic.numTouch) * 100;
        const specificityNotTouch = ((statistic.numCorrect - statistic.numCorrectTouch) / (numExample - statistic.numTouch)) * 100;
        const p = document.createElement("p");
        p.innerHTML = `
        Các thông số hiện tại:<br/>
        Accuracy : ${accuracy.toFixed(2)}%,<br/>
        Recall: ${sensitivity}% với lớp ${TOUCH_LABEL} , ${100 - sensitivity}% với lớp ${NOT_TOUCH_LABEL},<br/>
        Precision : ${specificityTouch}% với lớp ${TOUCH_LABEL}, ${specificityNotTouch}% với lớp ${NOT_TOUCH_LABEL},
      `;


        document.body.appendChild(p);
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
        await drawImagePoint().catch((error) => console.log(error));
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
            <video
                className="video"
                autoPlay
                ref={video}
                id="video"
            />
            <div className="control">
                <button
                    className="btn addData"
                    onClick={() => {
                        setIsAdding((prevState) => !prevState);
                    }}
                >
                    Thêm các dataset có sẵn
                    <div
                        className="classes"
                        style={{
                            display: isAdding ? "block" : "none",
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
                                            const validFileTypes = ["image/jpeg", "image/png", "image/jpg"];
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
                        run().catch((error) => {
                            alert("Máy chưa có dữ liệu. Hãy thêm dữ liệu vào máy");
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
                    Lấy các thông số
                    <br />
                    DEVELOPER ONLY
                </button>
                <div className="add-image">
                    <p className="add-image-title">Thêm hình ảnh bạn muốn classify</p>
                    <input
                        type="file"
                        placeholder="Thêm hình ảnh bạn muốn classify"
                        onChange={handleAddAvailImage}
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




