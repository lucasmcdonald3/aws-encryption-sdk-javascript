/*
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use
 * this file except in compliance with the License. A copy of the License is
 * located at
 *
 *     http://aws.amazon.com/apache2.0/
 *
 * or in the "license" file accompanying this file. This file is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
 * implied. See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  NodeEncryptionMaterial,
  NodeDecryptionMaterial,
  WebCryptoEncryptionMaterial,
  WebCryptoDecryptionMaterial,
  isEncryptionMaterial,
  isDecryptionMaterial,
  NodeAlgorithmSuite

} from '@aws-crypto/material-management'

type Material = NodeEncryptionMaterial|NodeDecryptionMaterial|WebCryptoEncryptionMaterial|WebCryptoDecryptionMaterial

export function cloneMaterial<M extends Material> (source: M): M {
  const { suite, encryptionContext } = source

  const clone = suite instanceof NodeAlgorithmSuite
    ? source instanceof NodeEncryptionMaterial
      ? new NodeEncryptionMaterial(suite, encryptionContext)
      : new NodeDecryptionMaterial(suite, encryptionContext)
    : source instanceof WebCryptoEncryptionMaterial
      ? new WebCryptoEncryptionMaterial(suite, encryptionContext)
      : new WebCryptoDecryptionMaterial(suite, encryptionContext)

  const udk = new Uint8Array(source.getUnencryptedDataKey())
  clone.setUnencryptedDataKey(udk, source.keyringTrace[0])
  if ((<WebCryptoDecryptionMaterial>source).hasCryptoKey) {
    const cryptoKey = (<WebCryptoDecryptionMaterial>source).getCryptoKey()
    ;(<WebCryptoDecryptionMaterial>clone)
      .setCryptoKey(cryptoKey, clone.keyringTrace[0])
  }

  if (isEncryptionMaterial(source) && isEncryptionMaterial(clone)) {
    source.encryptedDataKeys.forEach(edk => {
      const { providerInfo, providerId } = edk
      const trace = source.keyringTrace.find(({ keyNamespace, keyName }) => keyName === providerInfo && keyNamespace === providerId)
      if (!trace) throw new Error('Malformed Encrypted Data Key')
      clone.addEncryptedDataKey(edk, trace.flags)
    })

    if (source.suite.signatureCurve && source.signatureKey) {
      clone.setSignatureKey(source.signatureKey)
    }
  } else if (isDecryptionMaterial(source) && isDecryptionMaterial(clone)) {
    if (source.suite.signatureCurve && source.verificationKey) {
      clone.setVerificationKey(source.verificationKey)
    }
  } else {
    throw new Error('Material mismatch')
  }

  return <M>clone
}
