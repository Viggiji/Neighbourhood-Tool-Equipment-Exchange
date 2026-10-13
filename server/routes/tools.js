const express = require('express');
const multer  = require('multer');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// ─── Multer — memory storage (we upload to Supabase, not disk) ──
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG and PNG images are allowed.'));
    }
  },
});

const STORAGE_BUCKET   = 'tool-images'; // Supabase Storage bucket name
const VALID_CATEGORIES = [
  'Power Tools',
  'Hand Tools',
  'Gardening',
  'Ladders & Scaffolding',
  'Other',
];

// ─── Helper: upload buffer to Supabase Storage ────────────────
async function uploadImageToSupabase(db, file) {
  if (!file) return null;

  const ext      = file.mimetype === 'image/jpeg' ? 'jpg' : 'png';
  const filename = `${uuidv4()}.${ext}`;

  const { error } = await db.storage
    .from(STORAGE_BUCKET)
    .upload(filename, file.buffer, { contentType: file.mimetype, upsert: false });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = db.storage.from(STORAGE_BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

// ─── GET /api/tools/categories ────────────────────────────────
// IMPORTANT: Must be declared BEFORE /:id to avoid shadowing
router.get('/categories', (req, res) => {
  res.json({ categories: VALID_CATEGORIES });
});

// ─── GET /api/tools — Public feed ────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { search, category, status } = req.query;
    const db = getDb();

    let query = db
      .from('tools')
      .select(`
        id, title, category, description, condition, deposit_amount,
        status, image_url, created_at,
        users ( full_name, block_code )
      `)
      .order('created_at', { ascending: false });

    // Status filter
    if (status) {
      query = query.eq('status', status);
    } else {
      query = query.in('status', ['Available', 'Online']);
    }

    if (category) query = query.eq('category', category);
    if (search)   query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);

    const { data: tools, error } = await query;
    if (error) throw error;

    res.json({
      tools: tools.map(t => ({
        id:           t.id,
        title:        t.title,
        category:     t.category,
        description:  t.description,
        condition:    t.condition,
        depositAmount: t.deposit_amount,
        status:       t.status,
        imageUrl:     t.image_url,
        ownerName:    t.users?.full_name,
        ownerBlock:   t.users?.block_code,
        createdAt:    t.created_at,
      })),
    });
  } catch (err) {
    console.error('Fetch tools error:', err);
    res.status(500).json({ message: 'Could not load tools.' });
  }
});

// ─── GET /api/tools/my — Current user's tools ─────────────────
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const { data: tools, error } = await db
      .from('tools')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      tools: tools.map(t => ({
        id:           t.id,
        title:        t.title,
        category:     t.category,
        description:  t.description,
        condition:    t.condition,
        depositAmount: t.deposit_amount,
        status:       t.status,
        imageUrl:     t.image_url,
        createdAt:    t.created_at,
      })),
    });
  } catch (err) {
    console.error('Fetch my tools error:', err);
    res.status(500).json({ message: 'Could not load your tools.' });
  }
});

// ─── GET /api/tools/:id — Single tool ────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const db = getDb();
    const { data: tool, error } = await db
      .from('tools')
      .select(`
        id, title, category, description, condition, deposit_amount,
        status, image_url, created_at, user_id,
        users ( full_name, block_code )
      `)
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!tool)  return res.status(404).json({ message: 'Tool not found.' });

    res.json({
      tool: {
        id:           tool.id,
        title:        tool.title,
        category:     tool.category,
        description:  tool.description,
        condition:    tool.condition,
        depositAmount: tool.deposit_amount,
        status:       tool.status,
        imageUrl:     tool.image_url,
        ownerId:      tool.user_id,
        ownerName:    tool.users?.full_name,
        ownerBlock:   tool.users?.block_code,
        createdAt:    tool.created_at,
      },
    });
  } catch (err) {
    console.error('Fetch tool error:', err);
    res.status(500).json({ message: 'Could not load tool details.' });
  }
});

// ─── POST /api/tools — Create a tool ─────────────────────────
router.post('/', authenticateToken, (req, res, next) => {
  upload.single('image')(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: 'File upload error.', errors: { image: err.message } });
    } else if (err) {
      return res.status(400).json({ message: 'Invalid file.', errors: { image: err.message } });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { title, category, description, condition, depositAmount } = req.body;
    const errors = {};

    if (!title?.trim()) errors.title = 'Tool name is required.';
    else if (title.trim().length < 3) errors.title = 'Tool name should be at least 3 characters.';
    if (!category?.trim()) errors.category = 'Select a category.';
    else if (!VALID_CATEGORIES.includes(category)) errors.category = 'Please select a valid category.';
    if (!description?.trim()) errors.description = 'Provide a description.';
    else if (description.trim().length < 10) errors.description = 'Description should be at least 10 characters.';
    if (!condition?.trim()) errors.condition = 'Specify condition.';
    if (depositAmount === undefined || depositAmount === null || depositAmount === '') {
      errors.depositAmount = 'Specify deposit amount.';
    } else if (isNaN(Number(depositAmount)) || Number(depositAmount) < 0) {
      errors.depositAmount = 'Must be a valid positive number.';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ message: 'Validation failed.', errors });
    }

    const db = getDb();
    const imageUrl = await uploadImageToSupabase(db, req.file);

    const { data: tool, error } = await db
      .from('tools')
      .insert({
        user_id:        req.user.id,
        title:          title.trim(),
        category:       category.trim(),
        description:    description.trim(),
        condition:      condition.trim(),
        deposit_amount: Number(depositAmount),
        status:         'Available',
        image_url:      imageUrl,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      message: 'Tool added successfully.',
      tool: {
        id:           tool.id,
        title:        tool.title,
        category:     tool.category,
        description:  tool.description,
        condition:    tool.condition,
        depositAmount: tool.deposit_amount,
        status:       tool.status,
        imageUrl:     tool.image_url,
        createdAt:    tool.created_at,
      },
    });
  } catch (err) {
    console.error('Create tool error:', err);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
});

// ─── PUT /api/tools/:id — Update a tool ──────────────────────
router.put('/:id', authenticateToken, (req, res, next) => {
  upload.single('image')(req, res, function (err) {
    if (err) return res.status(400).json({ message: 'File upload error.', errors: { image: err.message } });
    next();
  });
}, async (req, res) => {
  try {
    const { title, category, description, condition, depositAmount, status } = req.body;
    const db = getDb();

    const { data: existing, error: fetchErr } = await db
      .from('tools')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!existing)                      return res.status(404).json({ message: 'Tool not found.' });
    if (existing.user_id !== req.user.id) return res.status(403).json({ message: 'Not authorized to edit this tool.' });

    // Only upload a new image if a file was provided
    const imageUrl = req.file
      ? await uploadImageToSupabase(db, req.file)
      : existing.image_url;

    const { error } = await db
      .from('tools')
      .update({
        title:          title?.trim()        || existing.title,
        category:       category?.trim()     || existing.category,
        description:    description?.trim()  || existing.description,
        condition:      condition?.trim()    || existing.condition,
        deposit_amount: depositAmount !== undefined ? Number(depositAmount) : existing.deposit_amount,
        status:         status               || existing.status,
        image_url:      imageUrl,
        updated_at:     new Date().toISOString(),
      })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Tool updated successfully.' });
  } catch (err) {
    console.error('Update tool error:', err);
    res.status(500).json({ message: 'Could not update tool.' });
  }
});

// ─── DELETE /api/tools/:id — Remove a tool ───────────────────
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const { data: existing, error: fetchErr } = await db
      .from('tools')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!existing)                      return res.status(404).json({ message: 'Tool not found.' });
    if (existing.user_id !== req.user.id) return res.status(403).json({ message: 'Not authorized to delete this tool.' });

    const { error } = await db.from('tools').delete().eq('id', req.params.id);
    if (error) throw error;

    res.json({ message: 'Tool deleted successfully.' });
  } catch (err) {
    console.error('Delete tool error:', err);
    res.status(500).json({ message: 'Could not delete tool.' });
  }
});

module.exports = router;
