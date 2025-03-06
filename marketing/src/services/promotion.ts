import { List } from "immutable";
import moment from "moment";

export interface Promotion {
    "code": string,
    "discount": number,
    "availibility": Availibility,
}

interface IndefiniteAvailibility {
    "type": "indefinite",
}

interface AvailibilityDateRange {
    "type": "date_range",
    "start_date": moment.Moment,
    "end_date": moment.Moment,
}

interface AvailibilityBefore {
    "type": "before",
    "date": moment.Moment,
}

interface AvailibilityAfter {
    "type": "after",
    "date": moment.Moment,
}

type Availibility = IndefiniteAvailibility | AvailibilityDateRange | AvailibilityBefore | AvailibilityAfter;

interface PromotionFrame {
    promotion: Promotion,
    weight: number,
}

const promotion_frames: List<PromotionFrame> = List([
    {
        promotion: {
            code: "LAUNCHSALE",
            discount: 0.7,
            availibility: {
                type: "indefinite",
            },
        },
        weight: 5,
    },
    {
        promotion: {
            code: "FIRSTSMILE",
            discount: 0.6,
            availibility: {
                type: "indefinite",
            },
        },
        weight: 15,
    },
    {
        promotion: {
            code: "NAPTIME",
            discount: 0.5,
            availibility: {
                type: "indefinite",
            },
        },
        weight: 10,
    },
    {
        promotion: {
            code: "PEEKABOO",
            discount: 0.5,
            availibility: {
                type: "indefinite",
            },
        },
        weight: 11,
    }
])

const available_promotion_frames = promotion_frames.filter((promotion_frame) => {
    if (promotion_frame === undefined) return false;
    const { availibility } = promotion_frame.promotion;
    switch (availibility.type) {
        case "indefinite":
            return true;
        case "date_range": {
            const now = moment();
            const after_start = now.isAfter(availibility.start_date);
            const before_end = now.isBefore(availibility.end_date);
            return after_start && before_end;
        }
        case "before": {
            const now = moment();
            return now.isBefore(availibility.date);
        }
        case "after": {
            const now = moment();
            return now.isAfter(availibility.date);
        }
        default:
            return false;
    }
});

const local_storage_key = 'promo_code';
const try_get_previous_promotion = (): Promotion | null => {
    try {
        const previous_code = localStorage.getItem(local_storage_key);
        if (!previous_code) return null;
        const previous_promotion = available_promotion_frames.find((promotion_frame) => {
            if (promotion_frame === undefined) return false;
            return promotion_frame.promotion.code === previous_code;
        });
        if (previous_promotion === undefined) return null;
        return previous_promotion.promotion;
    } catch (error) { }
    return null;
}

const try_set_previous_promotion = (code: string) => {
    try {
        localStorage.setItem(local_storage_key, code);
    } catch (error) { }
}

const get_promotion = (): Promotion => {
    const previous_promotion = try_get_previous_promotion();
    if (previous_promotion) return previous_promotion;
    const total_weight = available_promotion_frames.reduce((total, promotion_frame) => {
        if (total === undefined) return 0;
        if (promotion_frame === undefined) return total;
        return total + promotion_frame.weight;
    }, 0);
    console.log("total", total_weight);
    let random_weight = Math.random() * total_weight;
    console.log("random", random_weight);
    let { promotion } = available_promotion_frames.last();
    available_promotion_frames.forEach((promotion_frame) => {
        if (promotion_frame === undefined) return;
        random_weight -= promotion_frame.weight;
        console.log(random_weight);
        if (random_weight < 0) {
            promotion = promotion_frame.promotion;
            return false;
        }
    });
    return promotion;
}

const promotion = get_promotion();
try_set_previous_promotion(promotion.code);

export default promotion;
