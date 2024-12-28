import { v4 as uuid } from 'uuid';

import LoggingService from "./LoggingService/ConsoleLoggingService";
import ErrorService from "./ErrorService";

describe('ErrorService', () => {
    describe('empty', () => {
        const new_error_service = () => {
            const logging_service = new LoggingService();
            return new ErrorService({
                logging_service,
            });
        }
        test('initial_state', () => {
            const error_service = new_error_service();
            expect(error_service.get_state().size).toBe(0);
        })
        test('add_error', () => {
            const error_service = new_error_service();
            error_service.add_error(new Error(uuid()));
            expect(error_service.get_state().size).toBe(1);
        })
        test('dismiss_error', () => {
            const error_service = new_error_service();
            error_service.dismiss_error(uuid());
            expect(error_service.get_state().size).toBe(0);
        })
        test('clear_errors', () => {
            const error_service = new_error_service();
            error_service.clear_errors();
            expect(error_service.get_state().size).toBe(0);
        })
    })
    describe('one error', () => {
        const new_error_service = () => {
            const logging_service = new LoggingService();
            const error_service = new ErrorService({
                logging_service,
            });
            error_service.add_error(new Error(uuid()));
            return error_service;
        }
        test('add_error', () => {
            const error_service = new_error_service();
            error_service.add_error(new Error(uuid()));
            expect(error_service.get_state().size).toBe(2);
        })
        describe('dismiss_error', () => {
            test('exists', () => {
                const error_service = new_error_service();
                const error_frame = error_service.get_state().first();
                if (error_frame === undefined) throw new Error('error_frame is undefined');
                error_service.dismiss_error(error_frame.id);
                expect(error_service.get_state().size).toBe(0);
            })
            test('does not exist', () => {
                const error_service = new_error_service();
                error_service.dismiss_error(uuid());
                expect(error_service.get_state().size).toBe(1);
            })
        })
        test('clear_errors', () => {
            const error_service = new_error_service();
            error_service.clear_errors();
            expect(error_service.get_state().size).toBe(0);
        })
    })
});