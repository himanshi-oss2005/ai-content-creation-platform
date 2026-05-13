const express = require('express');
const { authenticate, enforceJson } = require('../middleware/auth.middleware');
const { collectionRules, collectionUpdateRules, objectIdParam, validate } = require('../middleware/validate.middleware');
const { listCollections, createCollection, updateCollection, deleteCollection } = require('../controllers/collection.controller');

const router = express.Router();

router.use(authenticate);
router.get('/',       listCollections);
router.post('/',      enforceJson, ...collectionRules, validate, createCollection);
router.patch('/:id',  enforceJson, ...objectIdParam('id'), ...collectionUpdateRules, validate, updateCollection);
router.delete('/:id', enforceJson, ...objectIdParam('id'), validate, deleteCollection);

module.exports = router;
