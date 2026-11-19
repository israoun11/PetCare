import mongoose from 'mongoose';
import { app } from './app';
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/petcare').then(() => {
  app.listen(+(process.env.PORT || 5000), () => console.log('PETCARE API on :' + (process.env.PORT || 5000)));
}).catch(e => { console.error('MongoDB connection failed:', e.message); process.exit(1); });
