const express = require('express');
const matchController = require('../controllers/matchController');

const router = express.Router();

router.get('/', matchController.listMatches);
router.get('/mine', matchController.listMine);
router.post('/auto-finish', matchController.autoFinishExpiredHostMatches);
router.get('/:id', matchController.getMatch);
router.post('/:id/join/check', matchController.checkJoinMatch);
router.post('/:id/join', matchController.joinMatch);
router.post('/:id/leave', matchController.leaveMatch);
router.post('/:id/report-participant', matchController.reportParticipant);
router.patch('/:id', matchController.patchMatch);
router.delete('/:id', matchController.deleteMatch);
router.post('/', matchController.createMatch);

module.exports = router;
