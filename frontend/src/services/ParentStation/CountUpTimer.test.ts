import CountUpTimer from "./CountUpTimer"

describe('Timer', () => {
    describe('initialisation', () => {
        test('initial_state', () => {
            const timer = new CountUpTimer();
            const timer_state = timer.get_state();
            expect(timer_state).toBe('NotRunning');
            const elapsed_time = timer.get_elapsed_time().asMilliseconds();
            expect(elapsed_time).toBe(0);
        })
        test('start', () => {
            const timer = new CountUpTimer();
            timer.start();
            const timer_state = timer.get_state();
            expect(timer_state).toBe('Running');
            const elapsed_time = timer.get_elapsed_time().asMilliseconds();
            expect(elapsed_time).toBe(0);
        })
        test('pause', () => {
            const timer = new CountUpTimer();
            timer.pause();
            const timer_state = timer.get_state();
            expect(timer_state).toBe('NotRunning');
            const elapsed_time = timer.get_elapsed_time().asMilliseconds();
            expect(elapsed_time).toBe(0);
        })
        test('reset', () => {
            const timer = new CountUpTimer();
            timer.reset();
            const timer_state = timer.get_state();
            expect(timer_state).toBe('NotRunning');
            const elapsed_time = timer.get_elapsed_time().asMilliseconds();
            expect(elapsed_time).toBe(0);
        })
    })
    describe('running state', () => {
        const new_running_timer = async () => {
            const timer = new CountUpTimer();
            timer.start();
            await new Promise(resolve => setTimeout(resolve, 2));
            return timer;
        }
        test('get_elapsed_time', async () => {
            const timer = await new_running_timer();
            const elapsed_time = timer.get_elapsed_time().asMilliseconds();
            expect(elapsed_time).toBeGreaterThanOrEqual(2);
            expect(elapsed_time).toBeLessThanOrEqual(5);
        })
        test('start', async () => {
            const timer = await new_running_timer();
            timer.start();
            const timer_state = timer.get_state();
            expect(timer_state).toBe('Running');
            const elapsed_time = timer.get_elapsed_time().asMilliseconds();
            expect(elapsed_time).toBeGreaterThanOrEqual(2);
            expect(elapsed_time).toBeLessThanOrEqual(5);
        })
        test('pause', async () => {
            const timer = await new_running_timer();
            timer.pause();
            const timer_state = timer.get_state();
            expect(timer_state).toBe('Paused');
            const elapsed_time = timer.get_elapsed_time().asMilliseconds();
            expect(elapsed_time).toBeGreaterThanOrEqual(2);
            expect(elapsed_time).toBeLessThanOrEqual(5);
        })
        test('reset', async () => {
            const timer = await new_running_timer();
            timer.reset();
            const timer_state = timer.get_state();
            expect(timer_state).toBe('NotRunning');
            const elapsed_time = timer.get_elapsed_time().asMilliseconds();
            expect(elapsed_time).toBe(0);
        })
    })
    describe('paused state', () => {
        const new_paused_timer = async () => {
            const timer = new CountUpTimer();
            timer.start();
            await new Promise(resolve => setTimeout(resolve, 2));
            timer.pause();
            return timer;
        }
        test('get_elapsed_time', async () => {
            const timer = await new_paused_timer();
            const elapsed_time = timer.get_elapsed_time().asMilliseconds();
            expect(elapsed_time).toBeGreaterThanOrEqual(2);
            expect(elapsed_time).toBeLessThanOrEqual(5);
        })
        test('start', async () => {
            const timer = await new_paused_timer();
            timer.start();
            await new Promise(resolve => setTimeout(resolve, 2));
            const timer_state = timer.get_state();
            expect(timer_state).toBe('Running');
            const elapsed_time = timer.get_elapsed_time().asMilliseconds();
            expect(elapsed_time).toBeGreaterThanOrEqual(4);
            expect(elapsed_time).toBeLessThanOrEqual(7);
        })
        test('pause', async () => {
            const timer = await new_paused_timer();
            timer.pause();
            const timer_state = timer.get_state();
            expect(timer_state).toBe('Paused');
            const elapsed_time = timer.get_elapsed_time().asMilliseconds();
            expect(elapsed_time).toBeGreaterThanOrEqual(2);
            expect(elapsed_time).toBeLessThanOrEqual(5);
        })
        test('reset', async () => {
            const timer = await new_paused_timer();
            timer.reset();
            const timer_state = timer.get_state();
            expect(timer_state).toBe('NotRunning');
            const elapsed_time = timer.get_elapsed_time().asMilliseconds();
            expect(elapsed_time).toBe(0);
        })
    })
    describe('after reset', () => {
        const new_reset_timer = async () => {
            const timer = new CountUpTimer();
            timer.start();
            await new Promise(resolve => setTimeout(resolve, 2));
            timer.reset();
            return timer;
        }
        test('get_elapsed_time', async () => {
            const timer = await new_reset_timer();
            const elapsed_time = timer.get_elapsed_time().asMilliseconds();
            expect(elapsed_time).toBe(0);
        })
        test('start', async () => {
            const timer = await new_reset_timer();
            timer.start();
            const timer_state = timer.get_state();
            expect(timer_state).toBe('Running');
            {
                const elapsed_time = timer.get_elapsed_time().asMilliseconds();
                expect(elapsed_time).toBe(0);
            }
            await new Promise(resolve => setTimeout(resolve, 2));
            {
                const elapsed_time = timer.get_elapsed_time().asMilliseconds();
                expect(elapsed_time).toBeGreaterThanOrEqual(2);
                expect(elapsed_time).toBeLessThanOrEqual(5);
            }
        })
    })
})