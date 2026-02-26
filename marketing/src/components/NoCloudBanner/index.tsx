import React from "react";
import "./style.scss";

const variants = [
    "video",
    "storage",
    "recording",
    "processing",
] as const;

const NoCloudBanner: React.FunctionComponent = () => {
    const [variantIndex, setVariantIndex] = React.useState(0);

    React.useEffect(() => {
        const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
        if (mediaQuery.matches) return;

        const intervalID = window.setInterval(() => {
            setVariantIndex((previousIndex) => (previousIndex + 1) % variants.length);
        }, 1800);

        return () => window.clearInterval(intervalID);
    }, []);

    return (
        <div className="support-line-banner rounded-pill bg-light text-dark fw-bold shadow-sm border border-primary-subtle" aria-live="polite">
            <span className="fixed-words" >No cloud&nbsp;</span>
            <span className="animated-words">
                {variants[variantIndex]}
            </span>
        </div>
    );
};

export default NoCloudBanner;
