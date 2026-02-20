import React from "react";
import { StaticImage } from "gatsby-plugin-image";

type Props = {
    className?: string;
};

const ZoomComparisonSlider: React.FunctionComponent<Props> = ({ className }) => {
    const [splitPercentage, setSplitPercentage] = React.useState(50);
    const sliderRef = React.useRef<HTMLDivElement | null>(null);
    const isDraggingRef = React.useRef(false);

    const setSplitFromClientX = React.useCallback((clientX: number) => {
        if (sliderRef.current == null) {
            return;
        }

        const sliderRect = sliderRef.current.getBoundingClientRect();
        if (sliderRect.width <= 0) {
            return;
        }

        const nextSplitPercentage = ((clientX - sliderRect.left) / sliderRect.width) * 100;
        const clampedSplitPercentage = Math.max(0, Math.min(100, nextSplitPercentage));
        setSplitPercentage(clampedSplitPercentage);
    }, []);

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        isDraggingRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        setSplitFromClientX(event.clientX);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!isDraggingRef.current) {
            return;
        }

        setSplitFromClientX(event.clientX);
    };

    const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        if (isDraggingRef.current) {
            setSplitFromClientX(event.clientX);
        }
        isDraggingRef.current = false;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    };

    return (
        <div className={className}>
            <div style={{ width: "100%", maxWidth: 380, margin: "0 auto" }}>
                <div
                    ref={sliderRef}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    onDragStart={(event) => {
                        event.preventDefault();
                    }}
                    role="slider"
                    aria-label="Compare zoomed in and zoomed out views"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(splitPercentage)}
                    style={{
                        position: "relative",
                        aspectRatio: "1080 / 2316",
                        overflow: "hidden",
                        borderRadius: 12,
                        border: "1px solid rgba(255, 255, 255, 0.25)",
                        cursor: "ew-resize",
                        touchAction: "none",
                        userSelect: "none",
                    }}
                >
                    <StaticImage
                        src="../../images/ZoomIn.jpg"
                        alt="Baby station view zoomed in"
                        transformOptions={{ fit: "cover" }}
                        style={{ height: "100%" }}
                        imgStyle={{
                            height: "100%",
                            width: "100%",
                            objectFit: "cover",
                            userSelect: "none",
                            pointerEvents: "none",
                        }}
                    />
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            clipPath: `inset(0 ${100 - splitPercentage}% 0 0)`,
                        }}
                    >
                        <StaticImage
                            src="../../images/ZoomOut.jpg"
                            alt="Baby station view zoomed out"
                            transformOptions={{ fit: "cover" }}
                            style={{ height: "100%" }}
                            imgStyle={{
                                height: "100%",
                                width: "100%",
                                objectFit: "cover",
                                userSelect: "none",
                                pointerEvents: "none",
                            }}
                        />
                    </div>
                    <div
                        aria-hidden
                        style={{
                            position: "absolute",
                            top: 0,
                            bottom: 0,
                            left: `${splitPercentage}%`,
                            width: 2,
                            transform: "translateX(-50%)",
                            backgroundColor: "#ffffff",
                            boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.2)",
                        }}
                    />
                    <div
                        aria-hidden
                        style={{
                            position: "absolute",
                            top: "50%",
                            left: `${splitPercentage}%`,
                            transform: "translate(-50%, -50%)",
                            width: 42,
                            height: 42,
                            borderRadius: "50%",
                            border: "2px solid #fff",
                            backgroundColor: "#1f1f1f",
                            color: "#fff",
                            fontSize: 18,
                            lineHeight: "1",
                            padding: 0,
                            zIndex: 2,
                            cursor: "ew-resize",
                            pointerEvents: "none",
                            display: "grid",
                            placeItems: "center",
                        }}
                    >
                        ↔
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ZoomComparisonSlider;
