// Complete and corrected integration test content

const request = require('supertest');
const app = require('../app');

describe('Integration Tests', () => {
    it('should return a list of MCQs', async () => {
        const res = await request(app)
            .get('/api/mcqs')
            .expect(200);

        expect(res.body).toBeInstanceOf(Array);
    });

    it('should create a new MCQ', async () => {
        const mcq = { question: 'Sample Question?', options: ['Option A', 'Option B'], answer: 'Option A' };
        const res = await request(app)
            .post('/api/mcqs')
            .send(mcq)
            .expect(201);

        expect(res.body).toMatchObject(mcq);
    });

    it('should return 404 for an invalid route', async () => {
        await request(app)
            .get('/invalid-route')
            .expect(404);
    });
});