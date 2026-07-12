import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deliverVoiceResponse
} from '../services/voiceResponseService.js';

test('Voice Response exige texto', async () => {
  const result =
    await deliverVoiceResponse({
      chatId:
        '50588388940@c.us'
    });

  assert.equal(
    result.ok,
    false
  );

  assert.equal(
    result.status,
    'VOICE_RESPONSE_TEXT_MISSING'
  );
});

test('Voice Response exige chatId', async () => {
  const result =
    await deliverVoiceResponse({
      text:
        'Hola desde ELAN IA'
    });

  assert.equal(
    result.status,
    'VOICE_RESPONSE_CHAT_ID_MISSING'
  );
});

test('Voice Response genera Cedar y envía por WAHA', async () => {
  const calls = {
    generate: 0,
    send: 0
  };

  const result =
    await deliverVoiceResponse(
      {
        text:
          '  Hola   desde ELAN IA  ',
        chatId:
          '+505 8838 8940',
        session:
          'ELANKAV'
      },
      {
        generateVoice:
          async (input) => {
            calls.generate += 1;

            assert.equal(
              input.text,
              'Hola desde ELAN IA'
            );

            return {
              ok: true,
              status:
                'TTS_AUDIO_READY',
              profile:
                'elan-ia-official-v1',
              language:
                'es-419',
              provider:
                'openai',
              model:
                'gpt-4o-mini-tts',
              voice:
                'cedar',
              audio: {
                buffer:
                  Buffer.from(
                    'CEDAR-AUDIO'
                  ),
                mimeType:
                  'audio/mpeg',
                format:
                  'mp3',
                sizeBytes:
                  11,
                fileName:
                  'elan-ia-test.mp3'
              }
            };
          },

        sendVoice:
          async (input) => {
            calls.send += 1;

            assert.equal(
              input.chatId,
              '+505 8838 8940'
            );

            assert.equal(
              input.session,
              'ELANKAV'
            );

            assert.equal(
              input.audioBuffer.toString(),
              'CEDAR-AUDIO'
            );

            assert.equal(
              input.mimeType,
              'audio/mpeg'
            );

            return {
              ok: true,
              status:
                'WAHA_VOICE_SENT',
              provider:
                'waha',
              session:
                'ELANKAV',
              chatId:
                '50588388940@c.us',
              messageId:
                'VOICE-DELIVERY-001'
            };
          }
      }
    );

  assert.equal(
    calls.generate,
    1
  );

  assert.equal(
    calls.send,
    1
  );

  assert.equal(
    result.ok,
    true
  );

  assert.equal(
    result.status,
    'VOICE_RESPONSE_DELIVERED'
  );

  assert.equal(
    result.generated,
    true
  );

  assert.equal(
    result.sent,
    true
  );

  assert.equal(
    result.voice,
    'cedar'
  );

  assert.equal(
    result.delivery.messageId,
    'VOICE-DELIVERY-001'
  );
});

test('Voice Response no envía si falla TTS', async () => {
  let sendCalled = false;

  const result =
    await deliverVoiceResponse(
      {
        text: 'Hola',
        chatId:
          '50588388940@c.us'
      },
      {
        generateVoice:
          async () => ({
            ok: false,
            status:
              'OPENAI_TTS_RATE_LIMITED'
          }),

        sendVoice:
          async () => {
            sendCalled = true;

            return {
              ok: true
            };
          }
      }
    );

  assert.equal(
    sendCalled,
    false
  );

  assert.equal(
    result.status,
    'OPENAI_TTS_RATE_LIMITED'
  );

  assert.equal(
    result.generated,
    false
  );
});

test('Voice Response rechaza audio inválido', async () => {
  let sendCalled = false;

  const result =
    await deliverVoiceResponse(
      {
        text: 'Hola',
        chatId:
          '50588388940@c.us'
      },
      {
        generateVoice:
          async () => ({
            ok: true,
            profile:
              'elan-ia-official-v1',
            voice:
              'cedar',
            audio: {
              buffer:
                Buffer.alloc(0),
              mimeType:
                'audio/mpeg',
              format:
                'mp3',
              sizeBytes:
                0
            }
          }),

        sendVoice:
          async () => {
            sendCalled = true;
          }
      }
    );

  assert.equal(
    sendCalled,
    false
  );

  assert.equal(
    result.status,
    'VOICE_RESPONSE_AUDIO_INVALID'
  );
});

test('Voice Response conserva fallo controlado de WAHA', async () => {
  const result =
    await deliverVoiceResponse(
      {
        text: 'Hola',
        chatId:
          '50588388940@c.us'
      },
      {
        generateVoice:
          async () => ({
            ok: true,
            profile:
              'elan-ia-official-v1',
            language:
              'es-419',
            provider:
              'openai',
            model:
              'gpt-4o-mini-tts',
            voice:
              'cedar',
            audio: {
              buffer:
                Buffer.from(
                  'AUDIO'
                ),
              mimeType:
                'audio/mpeg',
              format:
                'mp3',
              sizeBytes:
                5,
              fileName:
                'elan-ia.mp3'
            }
          }),

        sendVoice:
          async () => ({
            ok: false,
            status:
              'WAHA_VOICE_RATE_LIMITED',
            provider:
              'waha'
          })
      }
    );

  assert.equal(
    result.ok,
    false
  );

  assert.equal(
    result.generated,
    true
  );

  assert.equal(
    result.sent,
    false
  );

  assert.equal(
    result.status,
    'WAHA_VOICE_RATE_LIMITED'
  );
});

test('Voice Response controla excepción de TTS', async () => {
  const result =
    await deliverVoiceResponse(
      {
        text: 'Hola',
        chatId:
          '50588388940@c.us'
      },
      {
        generateVoice:
          async () => {
            const error =
              new Error(
                'TTS unavailable'
              );

            error.code =
              'TTS_DOWN';

            throw error;
          }
      }
    );

  assert.equal(
    result.status,
    'VOICE_RESPONSE_TTS_UNEXPECTED_ERROR'
  );

  assert.equal(
    result.errorCode,
    'TTS_DOWN'
  );
});

test('Voice Response controla excepción de WAHA', async () => {
  const result =
    await deliverVoiceResponse(
      {
        text: 'Hola',
        chatId:
          '50588388940@c.us'
      },
      {
        generateVoice:
          async () => ({
            ok: true,
            profile:
              'elan-ia-official-v1',
            language:
              'es-419',
            provider:
              'openai',
            model:
              'gpt-4o-mini-tts',
            voice:
              'cedar',
            audio: {
              buffer:
                Buffer.from(
                  'AUDIO'
                ),
              mimeType:
                'audio/mpeg',
              format:
                'mp3',
              sizeBytes:
                5,
              fileName:
                'elan-ia.mp3'
            }
          }),

        sendVoice:
          async () => {
            const error =
              new Error(
                'WAHA unavailable'
              );

            error.code =
              'WAHA_DOWN';

            throw error;
          }
      }
    );

  assert.equal(
    result.status,
    'VOICE_RESPONSE_WAHA_UNEXPECTED_ERROR'
  );

  assert.equal(
    result.generated,
    true
  );

  assert.equal(
    result.sent,
    false
  );

  assert.equal(
    result.errorCode,
    'WAHA_DOWN'
  );
});
