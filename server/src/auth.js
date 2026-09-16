import jwt from 'jsonwebtoken';

export const fail = (status, message) => Object.assign(new Error(message), { status });

export function field(req, name, type, optional) {
  const v = req.body?.[name];
  if (v === undefined && optional) return undefined;
  if (typeof v !== type || (type === 'number' && !Number.isFinite(v))) throw fail(400, `${name} must be a ${type}`);
  return v;
}

// Validate a plain-object body field against { key: 'string' | 'number' }; unknown keys are dropped.
export function shape(req, name, spec) {
  const v = req.body?.[name];
  if (v === undefined) return undefined;
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw fail(400, `${name} must be an object`);
  const out = {};
  for (const [k, type] of Object.entries(spec)) {
    if (v[k] === undefined || v[k] === null || v[k] === '') continue;
    if (typeof v[k] !== type || (type === 'number' && !Number.isFinite(v[k]))) throw fail(400, `${name}.${k} must be a ${type}`);
    out[k] = v[k];
  }
  return out;
}

export const signToken = (user) =>
  jwt.sign({ id: String(user._id), role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

export function verifyToken(token) {
  const { id, role } = jwt.verify(token, process.env.JWT_SECRET);
  return { id, role };
}

const bearer = (req) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  return scheme === 'Bearer' && token ? token : null;
};

export function authRequired(req, res, next) {
  try {
    req.user = verifyToken(bearer(req));
    next();
  } catch {
    res.status(401).json({ error: 'unauthorized' });
  }
}

// Public routes: attach req.user when a valid token is present, otherwise a guest.
export function authOptional(req, res, next) {
  const token = bearer(req);
  try {
    req.user = token ? verifyToken(token) : { id: null, role: 'guest' };
  } catch {
    req.user = { id: null, role: 'guest' };
  }
  next();
}

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'forbidden' });

export const owns = (queue, user) => user.role === 'admin' || (!!user.id && String(queue.owner) === user.id);
