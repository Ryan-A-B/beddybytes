import { List } from "immutable";
import { v4 as uuid } from "uuid";
import Service from "./Service";
import LoggingService from "./LoggingService";

export interface ErrorFrame {
    id: string
    error: Error
}

interface NewErrorServiceInput {
    logging_service: LoggingService
}

class ErrorService extends Service<List<ErrorFrame>> {
    protected readonly name = 'ErrorService';
    
    constructor(input: NewErrorServiceInput) {
        super({
            logging_service: input.logging_service,
            initial_state: List<ErrorFrame>(),
        });
    }
    
    protected to_string = (state: List<ErrorFrame>): string => {
        return `n=${state.size}`;
    }
    
    public add_error = (error: Error): void => {
        const id = uuid();
        const error_frame = { id, error };
        const errors = this.get_state();
        this.set_state(errors.push(error_frame));
    }
    
    public dismiss_error = (id: string): void => {
        const errors = this.get_state();
        const index = errors.findIndex((error_frame) => error_frame.id === id);
        if (index === -1) return;
        this.set_state(errors.delete(index));
    }
    
    public clear_errors = (): void => {
        if (this.get_state().size === 0) return;
        this.set_state(List<ErrorFrame>());
    }
}

export default ErrorService;
