import React from "react";
import "./modal.css";

const Modal = ({ errorMessage }) => {
	return (
		<div className="modal">
			<img
				src="./assets/warning.png"
				alt={errorMessage}
				id="error"
				style={{
					display: "block",
					width: "50%",
				}}
			/>
		</div>
	);
};

export default Modal;
