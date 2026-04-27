import { Utils } from '@bsv/sdk'
import { Mnemonic } from '@bsv/sdk/compat'

/** Collapse whitespace to single spaces + trim. */
export const normalizeMnemonic = (phrase: string): string =>
  phrase.trim().toLowerCase().replace(/\s+/g, ' ')

/**
 * Decode a BIP-39 mnemonic string to its entropy bytes (reversing the mapping
 * that Mnemonic.fromEntropy() applies). Mirrors bsv-desktop's implementation
 * because @bsv/sdk/compat does not ship a words→entropy helper.
 *
 * Validates the BIP-39 checksum implicitly via the length check; any word
 * outside the English wordlist throws.
 */
export const mnemonicToEntropy = (phrase: string): number[] => {
  const normalized = normalizeMnemonic(phrase)
  const m = Mnemonic.fromString(normalized)
  const { value: wordlist, space } = m.Wordlist
  const words = normalized.split(space)

  let bin = ''
  for (const word of words) {
    const index = wordlist.indexOf(word)
    if (index < 0) throw new Error(`Invalid mnemonic word: "${word}"`)
    bin += ('00000000000' + index.toString(2)).slice(-11)
  }
  if (bin.length % 11 !== 0) {
    throw new Error(`Mnemonic entropy is not a multiple of 11 bits: ${bin.length}`)
  }

  const checksumBits = bin.length / 33
  const entropyBits = bin.slice(0, bin.length - checksumBits)
  const entropy: number[] = []
  for (let i = 0; i < entropyBits.length / 8; i++) {
    entropy.push(parseInt(entropyBits.slice(i * 8, (i + 1) * 8), 2))
  }
  return entropy
}

/** Encode a 32-byte key as a 24-word BIP-39 mnemonic. */
export const entropyToMnemonic = (bytes: number[]): string => {
  return Mnemonic.fromEntropy(bytes).toString()
}

/** Convenience for downloads. */
export const mnemonicToBase64Key = (phrase: string): string =>
  Utils.toBase64(mnemonicToEntropy(phrase))
