import { useState, useEffect } from 'react'

interface AutocompleteInputProps {
  value: string
  onChange: (value: string) => void
  suggestions: string[]
  placeholder?: string
  className?: string
}

export default function AutocompleteInput({
  value,
  onChange,
  suggestions,
  placeholder = 'Type here...',
  className = ''
}: AutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([])

  useEffect(() => {
    if (value.trim()) {
      const filtered = suggestions.filter(s =>
        s.toLowerCase().includes(value.toLowerCase())
      )
      setFilteredSuggestions(filtered)
      setIsOpen(filtered.length > 0)
    } else {
      setFilteredSuggestions([])
      setIsOpen(false)
    }
  }, [value, suggestions])

  const handleSelect = (suggestion: string) => {
    onChange(suggestion)
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => value.trim() && setIsOpen(true)}
        placeholder={placeholder}
        className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      />

      {isOpen && filteredSuggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50">
          {filteredSuggestions.map((suggestion, idx) => (
            <button
              key={idx}
              onClick={() => handleSelect(suggestion)}
              className="w-full text-left px-4 py-2 hover:bg-blue-50 transition first:rounded-t-lg last:rounded-b-lg"
            >
              <p className="font-medium text-gray-900">{suggestion}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
